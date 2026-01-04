// ===========================================
// YOUTUBE API CONFIGURATION
// ===========================================
const YOUTUBE_CONFIG = {
    // Your API endpoint (update this to your Vercel deployment URL)
    API_ENDPOINT: '/api/youtube', // This will be your Vercel function endpoint
    CHANNEL_ID: 'UCMq4uUwcWnYgfe3z5w3Kt7A',
    CACHE_DURATION: 600000, // Cache data for 10 minutes (600000ms)
    USE_LIVE_API: true, // Set to false to use manual data instead
    
    // Your YouTube Playlists (for filtering)
    PLAYLISTS: {
        'ad': 'PL-KySkbfyS663cCQlYn_ow4cHo62ZKlCC',
        'thm': 'PL-KySkbfyS64f7dhGoKMKP0YIT7H2tqpn',
        'htb': 'PL-KySkbfyS66qoidtOTfRzdWCZNngoT47',
        'ctf': 'PL-KySkbfyS64iVfW6xleDT18KTnifZAaM',
        'cloud': 'PL-KySkbfyS64iVfW6xleDT18KTnifZAaM'
    }
};

// Manual fallback data (used if API fails or USE_LIVE_API is false)
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
    playlistVideos: {},
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
    // Check local cache first
    if (youtubeDataCache.channelData && youtubeDataCache.allVideos && isCacheValid()) {
        console.log('✅ Using locally cached data');
        return {
            channelStats: youtubeDataCache.channelData,
            videos: youtubeDataCache.allVideos
        };
    }

    if (!YOUTUBE_CONFIG.USE_LIVE_API) {
        console.log('ℹ️ Live API disabled, using fallback data');
        return {
            channelStats: FALLBACK_DATA,
            videos: []
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

        // Update local cache
        youtubeDataCache.channelData = result.data.channelStats;
        youtubeDataCache.allVideos = result.data.videos;
        youtubeDataCache.timestamp = Date.now();

        return result.data;

    } catch (error) {
        console.error('❌ Error fetching YouTube data:', error);
        
        // Fall back to cached data if available
        if (youtubeDataCache.channelData && youtubeDataCache.allVideos) {
            console.log('⚠️ Using expired cache as fallback');
            return {
                channelStats: youtubeDataCache.channelData,
                videos: youtubeDataCache.allVideos
            };
        }
        
        // Ultimate fallback
        console.log('⚠️ Using hardcoded fallback data');
        return {
            channelStats: FALLBACK_DATA,
            videos: []
        };
    }
}

// ===========================================
// FETCH VIDEOS FROM PLAYLIST (Client-side filtering)
// ===========================================
async function fetchPlaylistVideos(playlistId) {
    // Note: This is now just filtering the already-fetched videos
    // You could enhance this to fetch specific playlists from the server if needed
    
    if (youtubeDataCache.playlistVideos[playlistId] && isCacheValid()) {
        console.log(`✅ Using cached playlist data for ${playlistId}`);
        return youtubeDataCache.playlistVideos[playlistId];
    }

    if (!YOUTUBE_CONFIG.USE_LIVE_API) {
        return [];
    }

    try {
        console.log(`🔄 Filtering videos for playlist: ${playlistId}...`);
        
        // For now, we'll fetch from the old method
        // In production, you might want to add another serverless endpoint for specific playlists
        const { API_KEY } = YOUTUBE_CONFIG;
        let allVideos = [];
        let nextPageToken = '';

        do {
            const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&pageToken=${nextPageToken}&key=${API_KEY}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.items) {
                allVideos = allVideos.concat(data.items.map(item => ({
                    id: item.snippet.resourceId.videoId,
                    title: item.snippet.title,
                    description: item.snippet.description,
                    thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
                    publishedAt: item.snippet.publishedAt,
                    url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`
                })));
            }

            nextPageToken = data.nextPageToken || '';
            
        } while (nextPageToken);

        youtubeDataCache.playlistVideos[playlistId] = allVideos;
        
        console.log(`✅ Fetched ${allVideos.length} videos from playlist`);
        return allVideos;

    } catch (error) {
        console.error('❌ Error fetching playlist videos:', error);
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
        
        const subscribersElem = document.getElementById('subscriberCount');
        const viewsElem = document.getElementById('viewCount');
        const videosElem = document.getElementById('videoCount');
        
        if (subscribersElem) {
            subscribersElem.textContent = stats.subscriberDisplay || formatNumber(stats.subscribers);
        }
        if (viewsElem) {
            viewsElem.textContent = stats.viewsDisplay || formatNumber(stats.totalViews);
        }
        if (videosElem) {
            videosElem.textContent = stats.videoCount;
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
        
        const subscribersElem = document.querySelector('.channel-stats .stat-value');
        const viewsElem = document.querySelectorAll('.channel-stats .stat-value')[1];
        
        if (subscribersElem) {
            subscribersElem.textContent = stats.subscriberDisplay || formatNumber(stats.subscribers);
        }
        if (viewsElem) {
            viewsElem.textContent = stats.viewsDisplay || formatNumber(stats.totalViews);
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
                <img src="${video.thumbnail}" alt="${video.title}">
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
    
    videosToShow.forEach((video, index) => {
        const card = createVideoCard(video);
        videoGrid.appendChild(card);
        
        // Animate in
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
    
    resultsCount.textContent = `Showing ${videoDisplayState.displayedCount} of ${totalVideos} tutorials`;
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
    
    videoDisplayState.allVideos = shuffleArray(allVideos);
    videoDisplayState.currentVideos = videoDisplayState.allVideos;
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
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        const filter = button.dataset.filter;
        videoDisplayState.currentFilter = filter;
        videoDisplayState.displayedCount = 0;
        
        console.log(`🎯 Filter clicked: ${filter}`);
        
        if (filter === 'all') {
            videoDisplayState.currentVideos = shuffleArray(videoDisplayState.allVideos);
            displayVideos(videoDisplayState.currentVideos, false);
        } else {
            const playlistId = YOUTUBE_CONFIG.PLAYLISTS[filter];
            if (playlistId) {
                const playlistVideos = await fetchPlaylistVideos(playlistId);
                videoDisplayState.currentVideos = shuffleArray(playlistVideos);
                displayVideos(videoDisplayState.currentVideos, false);
            }
        }
        
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
    });
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
            const videoGrid = document.querySelector('.video-grid');
            const allCards = videoGrid.querySelectorAll('.video-card');
            allCards.forEach(card => {
                card.style.display = 'block';
            });
            
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
updateStatsSection();
updateYouTubeWidget();
initializeVideoGrid();

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