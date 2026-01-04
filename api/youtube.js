// ===========================================
// VERCEL SERVERLESS FUNCTION - YouTube API
// ===========================================
// This function handles YouTube Data API requests server-side
// to protect your API key and optimize quota usage

// Simple in-memory cache (resets when function cold-starts)
let cache = {
  channelData: null,
  videos: null,
  timestamp: null
};

const CACHE_DURATION = 600000; // 10 minutes in milliseconds

function isCacheValid() {
  if (!cache.timestamp) return false;
  return (Date.now() - cache.timestamp) < CACHE_DURATION;
}

export default async function handler(req, res) {
  // Enable CORS for your domain
  res.setHeader('Access-Control-Allow-Origin', '*'); // Change to your domain in production
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const API_KEY = process.env.YOUTUBE_API_KEY;
    
    if (!API_KEY) {
      console.error('❌ YOUTUBE_API_KEY environment variable not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Check if we have valid cached data
    if (isCacheValid() && cache.channelData && cache.videos) {
      console.log('✅ Returning cached data');
      return res.status(200).json({
        success: true,
        cached: true,
        data: {
          channelStats: cache.channelData,
          videos: cache.videos
        }
      });
    }

    console.log('🔄 Fetching fresh data from YouTube API...');

    // STEP 1: Get channel statistics AND uploads playlist ID
    // This is ONE API call (1 quota unit) that gives us both stats and the uploads playlist
    const CHANNEL_ID = 'UCMq4uUwcWnYgfe3z5w3Kt7A';
    
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails,snippet&id=${CHANNEL_ID}&key=${API_KEY}`
    );

    if (!channelResponse.ok) {
      const errorText = await channelResponse.text();
      console.error('❌ Channel API error:', channelResponse.status, errorText);
      throw new Error(`YouTube API error: ${channelResponse.status}`);
    }

    const channelData = await channelResponse.json();
    
    if (!channelData.items || channelData.items.length === 0) {
      throw new Error('Channel not found');
    }

    const channel = channelData.items[0];
    const stats = channel.statistics;
    const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

    // Format channel statistics
    const channelStats = {
      subscribers: parseInt(stats.subscriberCount) || 0,
      totalViews: parseInt(stats.viewCount) || 0,
      videoCount: parseInt(stats.videoCount) || 0,
      subscriberDisplay: formatCount(parseInt(stats.subscriberCount)),
      viewsDisplay: formatCount(parseInt(stats.viewCount)),
      channelTitle: channel.snippet.title,
      channelDescription: channel.snippet.description,
      channelThumbnail: channel.snippet.thumbnails.high?.url || channel.snippet.thumbnails.default?.url
    };

    console.log(`📊 Channel Stats: ${channelStats.subscribers} subs, ${channelStats.videoCount} videos`);

    // STEP 2: Fetch videos from the uploads playlist
    // Using playlistItems.list costs only 1 quota unit (vs 100 for search.list)
    let allVideos = [];
    let nextPageToken = '';
    let pageCount = 0;

    do {
      const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&pageToken=${nextPageToken}&key=${API_KEY}`;
      
      const playlistResponse = await fetch(playlistUrl);
      
      if (!playlistResponse.ok) {
        const errorText = await playlistResponse.text();
        console.error('❌ Playlist API error:', playlistResponse.status, errorText);
        throw new Error(`YouTube API error: ${playlistResponse.status}`);
      }

      const playlistData = await playlistResponse.json();
      
      if (playlistData.items) {
        const videos = playlistData.items.map(item => ({
          id: item.contentDetails.videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnail: item.snippet.thumbnails.high?.url || 
                     item.snippet.thumbnails.medium?.url || 
                     item.snippet.thumbnails.default?.url,
          publishedAt: item.snippet.publishedAt,
          url: `https://www.youtube.com/watch?v=${item.contentDetails.videoId}`,
          channelTitle: item.snippet.channelTitle
        }));
        
        allVideos = allVideos.concat(videos);
      }

      nextPageToken = playlistData.nextPageToken || '';
      pageCount++;
      
      // Safety limit: don't fetch more than 10 pages (500 videos)
      if (pageCount >= 10) {
        console.log('⚠️ Reached page limit (10 pages)');
        break;
      }
      
    } while (nextPageToken);

    console.log(`✅ Fetched ${allVideos.length} videos in ${pageCount} API calls`);

    // Update cache
    cache.channelData = channelStats;
    cache.videos = allVideos;
    cache.timestamp = Date.now();

    // Return the data
    return res.status(200).json({
      success: true,
      cached: false,
      quotaUsed: 1 + pageCount, // 1 for channel stats, pageCount for playlist items
      data: {
        channelStats,
        videos: allVideos
      }
    });

  } catch (error) {
    console.error('❌ Error in YouTube API function:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

// Helper function to format large numbers
function formatCount(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}