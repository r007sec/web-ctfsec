// ===========================================
// YOUTUBE API CONFIGURATION
// ===========================================
const YOUTUBE_CONFIG = {
    API_ENDPOINT: '/api/youtube',
    CHANNEL_ID: 'UCMq4uUwcWnYgfe3z5w3Kt7A',
    CACHE_DURATION: 600000,
    USE_LIVE_API: true,
    
    PLAYLISTS: {
        'ad': 'PL-KySkbfyS663cCQlYn_ow4cHo62ZKlCC',
        'thm': 'PL-KySkbfyS64f7dhGoKMKP0YIT7H2tqpn',
        'htb': 'PL-KySkbfyS66qoidtOTfRzdWCZNngoT47',
        'ctf': 'PL-KySkbfyS64iVfW6xleDT18KTnifZAaM',
        'cloud': 'PL-KySkbfyS64iVfW6xleDT18KTnifZAaM'
    }
};

const FALLBACK_DATA = {
    subscribers: 3020,
    totalViews: 135181,
    videoCount: 121,
    studentsImpacted: 6040,
    latestUpload: '2 days ago',
    subscriberDisplay: '3K+',
    totalVideos: '121'
};

// ===========================================
// MOBILE MENU TOGGLE
// ===========================================
const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
const mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');
const mobileNavLinks = document.querySelectorAll('.mobile-nav-links a');

if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
        mobileMenuToggle.classList.toggle('active');
        mobileMenuOverlay.classList.toggle('active');
        document.body.style.overflow = mobileMenuOverlay.classList.contains('active') ? 'hidden' : '';
    });

    mobileNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenuToggle.classList.remove('active');
            mobileMenuOverlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    mobileMenuOverlay.addEventListener('click', (e) => {
        if (e.target === mobileMenuOverlay) {
            mobileMenuToggle.classList.remove('active');
            mobileMenuOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

// ===========================================
// SMOOTH SCROLLING
// ===========================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// ===========================================
// YOUTUBE DATA CACHE
// ===========================================
let youtubeDataCache = {
    channelData: null,
    allVideos: null,
    playlists: {},
    timestamp: null
};

function isCacheValid() {
    if (!youtubeDataCache.timestamp) return false;
    const now = Date.now();
    return (now - youtubeDataCache.timestamp) < YOUTUBE_CONFIG.CACHE_DURATION;
}

// ===========================================
// FETCH DATA FROM SERVERLESS FUNCTION
// ===========================================
async function fetchYouTubeData() {
    if (youtubeDataCache.channelData && youtubeDataCache.allVideos && isCacheValid()) {
        console.log('✅ Using locally cached data');
        return {
            channelStats: youtubeDataCache.channelData,
            videos: youtubeDataCache.allVideos,
            playlists: youtubeDataCache.playlists
        };
    }

    if (!YOUTUBE_CONFIG.USE_LIVE_API) {
        console.log('ℹ️ Live API disabled, using fallback data');
        return {
            channelStats: FALLBACK_DATA,
            videos: [],
            playlists: {}
        };
    }

    try {
        console.log('🔄 Fetching data from serverless function...');
        
        const response = await fetch(YOUTUBE_CONFIG.API_ENDPOINT);
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Unknown error from API');
        }

        console.log(`✅ Data received (cached on server: ${result.cached})`);
        if (!result.cached && result.quotaUsed) {
            console.log(`📊 Quota used: ${result.quotaUsed} units`);
        }

        youtubeDataCache.channelData = result.data.channelStats;
        youtubeDataCache.allVideos = result.data.videos;
        youtubeDataCache.playlists = result.data.playlists || {};
        youtubeDataCache.timestamp = Date.now();

        return result.data;

    } catch (error) {
        console.error('❌ Error fetching YouTube data:', error);
        
        if (youtubeDataCache.channelData && youtubeDataCache.allVideos) {
            console.log('⚠️ Using expired cache as fallback');
            return {
                channelStats: youtubeDataCache.channelData,
                videos: youtubeDataCache.allVideos,
                playlists: youtubeDataCache.playlists
            };
        }
        
        console.log('⚠️ Using hardcoded fallback data');
        return {
            channelStats: FALLBACK_DATA,
            videos: [],
            playlists: {}
        };
    }
}

// ===========================================
// FETCH SPECIFIC PLAYLIST
// ===========================================
async function fetchPlaylist(playlistName) {
    // Check local cache first
    if (youtubeDataCache.playlists[playlistName] && isCacheValid()) {
        console.log(`✅ Using cached playlist: ${playlistName}`);
        return youtubeDataCache.playlists[playlistName];
    }

    if (!YOUTUBE_CONFIG.USE_LIVE_API) {
        return [];
    }

    try {
        console.log(`🔄 Fetching playlist: ${playlistName}...`);
        
        const response = await fetch(`${YOUTUBE_CONFIG.API_ENDPOINT}?playlist=${playlistName}`);
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Unknown error from API');
        }

        console.log(`✅ Playlist "${playlistName}" fetched (${result.data.videos.length} videos)`);
        
        // Cache the playlist
        youtubeDataCache.playlists[playlistName] = result.data.videos;
        
        return result.data.videos;

    } catch (error) {
        console.error(`❌ Error fetching playlist ${playlistName}:`, error);
        return [];
    }
}

// ===========================================
// VIDEO DISPLAY STATE
// ===========================================
const videoDisplayState = {
    allVideos: [],
    currentVideos: [],
    displayedCount: 0,
    currentFilter: 'all',
    initialLoad: 3,
    loadMoreIncrement: 6
};

// ===========================================
// UPDATE STATS SECTION
// ===========================================
async function updateStatsSection() {
    try {
        const data = await fetchYouTubeData();
        const stats = data.channelStats;
        
        // Animated counter for stats
        const animateCounter = (element, target) => {
            if (!element) return;
            const duration = 2000;
            const start = 0;
            const increment = target / (duration / 16);
            let current = start;
            
            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    element.textContent = formatNumber(target);
                    clearInterval(timer);
                } else {
                    element.textContent = formatNumber(Math.floor(current));
                }
            }, 16);
        };
        
        const subscribersElem = document.getElementById('subscriberCount');
        const viewsElem = document.getElementById('viewCount');
        const videosElem = document.getElementById('videoCount');
        
        if (subscribersElem) {
            subscribersElem.dataset.target = stats.subscribers;
            animateCounter(subscribersElem, stats.subscribers);
        }
        if (viewsElem) {
            viewsElem.dataset.target = stats.totalViews;
            animateCounter(viewsElem, stats.totalViews);
        }
        if (videosElem) {
            videosElem.dataset.target = stats.videoCount;
            animateCounter(videosElem, stats.videoCount);
        }
        
        console.log('✅ Stats section updated');
    } catch (error) {
        console.error('❌ Error updating stats:', error);
    }
}

// ===========================================
// UPDATE YOUTUBE WIDGET
// ===========================================
async function updateYouTubeWidget() {
    try {
        const data = await fetchYouTubeData();
        const stats = data.channelStats;
        const videos = data.videos;
        
        // Update latest video
        const latestVideoElem = document.getElementById('latestVideo');
        if (latestVideoElem && videos && videos.length > 0) {
            const latestVideo = videos[0];
            const publishDate = new Date(latestVideo.publishedAt);
            const now = new Date();
            const diffTime = Math.abs(now - publishDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            let timeAgo;
            if (diffDays === 0) {
                timeAgo = 'Today';
            } else if (diffDays === 1) {
                timeAgo = 'Yesterday';
            } else if (diffDays < 7) {
                timeAgo = `${diffDays} days ago`;
            } else if (diffDays < 30) {
                const weeks = Math.floor(diffDays / 7);
                timeAgo = `${weeks} week${weeks > 1 ? 's' : ''} ago`;
            } else {
                const months = Math.floor(diffDays / 30);
                timeAgo = `${months} month${months > 1 ? 's' : ''} ago`;
            }
            
            latestVideoElem.textContent = timeAgo;
        }
        
        // Update live subscribers
        const liveSubsElem = document.getElementById('liveSubscribers');
        if (liveSubsElem) {
            liveSubsElem.textContent = stats.subscriberDisplay || formatNumber(stats.subscribers);
        }
        
        // Update total videos
        const liveTotalVideosElem = document.getElementById('liveTotalVideos');
        if (liveTotalVideosElem) {
            liveTotalVideosElem.textContent = stats.videoCount;
        }
        
        console.log('✅ YouTube widget updated');
    } catch (error) {
        console.error('❌ Error updating widget:', error);
    }
}

// ===========================================
// FORMAT NUMBER HELPER
// ===========================================
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
}

// ===========================================
// CREATE VIDEO CARD
// ===========================================
function createVideoCard(video) {
    const article = document.createElement('article');
    article.className = 'video-card';
    article.style.opacity = '0';
    article.style.transform = 'translateY(20px)';
    
    article.innerHTML = `
        <a href="${video.url}" target="_blank">
            <div class="video-thumbnail">
                <img src="${video.thumbnail}" alt="${video.title}" loading="lazy">
                <div class="play-overlay"></div>
            </div>
        </a>
        <div class="video-info">
            <h3>${video.title}</h3>
            <p>${video.description.substring(0, 150)}${video.description.length > 150 ? '...' : ''}</p>
            <a href="${video.url}" class="watch-btn" target="_blank">Watch Tutorial</a>
        </div>
    `;
    
    return article;
}

// ===========================================
// DISPLAY VIDEOS
// ===========================================
function displayVideos(videos, append = false) {
    const videoGrid = document.querySelector('.video-grid');
    
    if (!append) {
        videoGrid.innerHTML = '';
        videoDisplayState.displayedCount = 0;
    }
    
    const startIndex = videoDisplayState.displayedCount;
    const endIndex = startIndex + (videoDisplayState.displayedCount === 0 ? videoDisplayState.initialLoad : videoDisplayState.loadMoreIncrement);
    const videosToShow = videos.slice(startIndex, endIndex);
    
    if (videosToShow.length === 0 && !append) {
        videoGrid.innerHTML = '<p style="text-align: center; color: var(--text-muted); grid-column: 1/-1; padding: 3rem;">No videos found in this category.</p>';
        updateLoadMoreButton(0);
        updateResultsCount(0);
        return;
    }
    
    videosToShow.forEach((video, index) => {
        const card = createVideoCard(video);
        videoGrid.appendChild(card);
        
        setTimeout(() => {
            card.style.transition = `all 0.6s ease ${index * 0.1}s`;
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 50);
    });
    
    videoDisplayState.displayedCount = endIndex;
    updateLoadMoreButton(videos.length);
    updateResultsCount(videos.length);
}

// ===========================================
// UPDATE LOAD MORE BUTTON
// ===========================================
function updateLoadMoreButton(totalVideos) {
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (!loadMoreBtn) return;
    
    if (videoDisplayState.displayedCount >= totalVideos) {
        loadMoreBtn.classList.add('hidden');
    } else {
        loadMoreBtn.classList.remove('hidden');
        const remaining = totalVideos - videoDisplayState.displayedCount;
        const willShow = Math.min(remaining, videoDisplayState.loadMoreIncrement);
        loadMoreBtn.innerHTML = `Load ${willShow} More Videos <span class="arrow-down">↓</span>`;
    }
}

// ===========================================
// UPDATE RESULTS COUNT
// ===========================================
function updateResultsCount(totalVideos) {
    const resultsCount = document.getElementById('resultsCount');
    if (!resultsCount) return;
    
    resultsCount.textContent = `Showing ${Math.min(videoDisplayState.displayedCount, totalVideos)} of ${totalVideos} tutorials`;
}

// ===========================================
// SHUFFLE ARRAY
// ===========================================
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// ===========================================
// INITIALIZE VIDEO GRID
// ===========================================
async function initializeVideoGrid() {
    console.log('🎬 Initializing video grid...');
    
    const data = await fetchYouTubeData();
    const allVideos = data.videos;
    
    if (allVideos.length === 0) {
        console.warn('⚠️ No videos fetched, keeping existing HTML videos');
        return;
    }
    
    videoDisplayState.allVideos = allVideos;
    videoDisplayState.currentVideos = allVideos;
    displayVideos(videoDisplayState.currentVideos, false);
    
    console.log(`✅ Video grid initialized with ${allVideos.length} videos`);
}

// ===========================================
// LOAD MORE BUTTON HANDLER
// ===========================================
const loadMoreBtn = document.getElementById('loadMoreBtn');
if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
        displayVideos(videoDisplayState.currentVideos, true);
        console.log(`📺 Loaded more videos. Now showing: ${videoDisplayState.displayedCount}`);
    });
}

// ===========================================
// FILTER BUTTONS (PLAYLIST BASED)
// ===========================================
const filterButtons = document.querySelectorAll('.filter-btn');

filterButtons.forEach(button => {
    button.addEventListener('click', async () => {
        // Visual feedback
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        button.disabled = true;
        button.textContent = 'Loading...';
        
        const filter = button.dataset.filter;
        videoDisplayState.currentFilter = filter;
        videoDisplayState.displayedCount = 0;
        
        console.log(`🎯 Filter clicked: ${filter}`);
        
        try {
            if (filter === 'all') {
                videoDisplayState.currentVideos = videoDisplayState.allVideos;
            } else {
                // Fetch the specific playlist
                const playlistVideos = await fetchPlaylist(filter);
                videoDisplayState.currentVideos = playlistVideos;
                console.log(`📊 Loaded ${playlistVideos.length} videos for playlist: ${filter}`);
            }
            
            displayVideos(videoDisplayState.currentVideos, false);
            
        } catch (error) {
            console.error(`❌ Error loading playlist ${filter}:`, error);
            videoDisplayState.currentVideos = [];
            displayVideos([], false);
        } finally {
            // Restore button
            button.disabled = false;
            button.textContent = button.dataset.originalText || filter.toUpperCase();
        }
        
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
    });
    
    // Store original button text
    if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
    }
});

// ===========================================
// SEARCH FUNCTIONALITY
// ===========================================
const searchInput = document.getElementById('searchInput');

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        if (searchTerm.length > 0) {
            const filtered = videoDisplayState.currentVideos.filter(video => {
                return video.title.toLowerCase().includes(searchTerm) ||
                       video.description.toLowerCase().includes(searchTerm);
            });
            
            videoDisplayState.displayedCount = 0;
            displayVideos(filtered, false);
            
            // Show all filtered results
            updateLoadMoreButton(0);
            updateResultsCount(filtered.length);
            
            console.log(`🔍 Search: "${searchTerm}" - Found ${filtered.length} videos`);
        } else {
            videoDisplayState.displayedCount = 0;
            displayVideos(videoDisplayState.currentVideos, false);
        }
    });
}

// ===========================================
// INITIALIZE EVERYTHING
// ===========================================
async function initializeApp() {
    console.log('🚀 Initializing app...');
    
    await updateStatsSection();
    await updateYouTubeWidget();
    await initializeVideoGrid();
    
    console.log('✅ App initialized successfully');
}

// Start the app
initializeApp();

// Refresh stats every cache duration
setInterval(() => {
    console.log('🔄 Cache expired, refreshing data...');
    youtubeDataCache.timestamp = null;
    updateStatsSection();
    updateYouTubeWidget();
}, YOUTUBE_CONFIG.CACHE_DURATION);

// ===========================================
// FADE-IN ANIMATION ON SCROLL
// ===========================================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('.skill-card, .community-card').forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = `all 0.6s ease ${index * 0.1}s`;
    observer.observe(card);
});
