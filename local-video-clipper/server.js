const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve video files from parent directory
app.use('/videos', express.static(path.join(__dirname, '..')));

// Serve generated clips
app.use('/clips', express.static(path.join(__dirname, 'clips')));

// Serve transcripts
app.use('/transcripts', express.static(path.join(__dirname, '../Transcripts')));

// Ensure directories exist
const ensureDirectories = async () => {
  await fs.ensureDir(path.join(__dirname, 'clips'));
  await fs.ensureDir(path.join(__dirname, 'temp'));
};

const sanitizeFilename = (name, fallback = 'music-video') => {
  if (!name || typeof name !== 'string') return fallback;
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .trim();
  return normalized || fallback;
};

// Get available video files
app.get('/api/videos', async (req, res) => {
  try {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv'];
    const parentDir = path.join(__dirname, '..');
    const files = await fs.readdir(parentDir);
    
    const videoFiles = await Promise.all(
      files
        .filter(file => videoExtensions.some(ext => file.toLowerCase().endsWith(ext)))
        .map(async (file) => {
          const filePath = path.join(parentDir, file);
          const stats = await fs.stat(filePath);
          
          return {
            id: file.replace(/\.[^/.]+$/, ""),
            filename: file,
            title: file.replace(/\.[^/.]+$/, "").replace(/_/g, ' '),
            path: `/videos/${file}`,
            size: stats.size,
            modified: stats.mtime,
            created: stats.birthtime
          };
        })
    );

    res.json(videoFiles);
  } catch (error) {
    console.error('Error reading video files:', error);
    res.status(500).json({ error: 'Failed to read video files' });
  }
});

// Get available transcripts with automatic video mapping
app.get('/api/transcripts', async (req, res) => {
  try {
    const transcriptDir = path.join(__dirname, '../Transcripts');
    
    if (!await fs.pathExists(transcriptDir)) {
      return res.json([]);
    }
    
    const files = await fs.readdir(transcriptDir);
    
    const transcriptFiles = await Promise.all(
      files
        .filter(file => file.endsWith('.vtt'))
        .map(async (file) => {
          const filePath = path.join(transcriptDir, file);
          const stats = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf-8');
          
          // Count VTT segments (lines with -->)
          const segments = content.split('\n').filter(line => line.includes('-->')).length;
          
          return {
            id: file.replace('.vtt', ''),
            filename: file,
            title: file.replace('.vtt', '').replace(/_/g, ' '),
            path: `/transcripts/${file}`,
            size: stats.size,
            modified: stats.mtime,
            segments: segments,
            wordCount: content.split(' ').length
          };
        })
    );

    res.json(transcriptFiles);
  } catch (error) {
    console.error('Error reading transcript files:', error);
    res.status(500).json({ error: 'Failed to read transcript files' });
  }
});

// Get transcript content with parsed segments
app.get('/api/transcripts/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../Transcripts', filename);
    
    console.log(`🔍 Looking for transcript: ${filename}`);
    console.log(`🔍 Full path: ${filePath}`);
    
    if (!await fs.pathExists(filePath)) {
      console.log(`❌ Transcript not found: ${filePath}`);
      return res.status(404).json({ error: 'Transcript not found' });
    }
    
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Parse VTT content into segments
    const lines = content.split('\n');
    const segments = [];
    let segmentIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip WEBVTT header and empty lines
      if (line === 'WEBVTT' || line === '' || line.match(/^NOTE/)) {
        continue;
      }
      
      // Look for VTT timestamp lines (format: 00:00:10.500 --> 00:00:13.500)
      const timestampMatch = line.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/);
      if (timestampMatch) {
        const [, startHours, startMinutes, startSeconds, startMs, endHours, endMinutes, endSeconds, endMs] = timestampMatch;
        
        const startTime = (parseInt(startHours) * 3600 + parseInt(startMinutes) * 60 + parseInt(startSeconds)) * 1000 + parseInt(startMs);
        const endTime = (parseInt(endHours) * 3600 + parseInt(endMinutes) * 60 + parseInt(endSeconds)) * 1000 + parseInt(endMs);
        
        // Get the text from the next non-empty line(s)
        let text = '';
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (nextLine === '') {
            break; // Empty line indicates end of this segment
          }
          if (nextLine.match(/^\d{2}:\d{2}:\d{2}\.\d{3}/)) {
            break; // Next timestamp line
          }
          text += (text ? ' ' : '') + nextLine;
        }
        
        if (text) {
          segments.push({
            id: segmentIndex++,
            timestamp: startTime,
            start: startTime,
            end: endTime,
            text: text,
            speaker: 'Speaker'
          });
        }
      }
    }
    
    res.json({
      filename: filename,
      title: filename.replace('.vtt', '').replace(/_/g, ' '),
      segments: segments,
      totalSegments: segments.length,
      estimatedDuration: segments.length > 0 ? segments[segments.length - 1].end : 0
    });
    
  } catch (error) {
    console.error('Error reading transcript content:', error);
    res.status(500).json({ error: 'Failed to read transcript content' });
  }
});

// Auto-map videos to transcripts
app.get('/api/video-transcript-mapping', async (req, res) => {
  try {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv'];
    const parentDir = path.join(__dirname, '..');
    const transcriptDir = path.join(__dirname, '../Transcripts');
    
    // Get videos
    const videoFiles = await fs.readdir(parentDir);
    const videos = videoFiles.filter(file => 
      videoExtensions.some(ext => file.toLowerCase().endsWith(ext))
    );
    
    // Get transcripts
    let transcripts = [];
    if (await fs.pathExists(transcriptDir)) {
      const transcriptFiles = await fs.readdir(transcriptDir);
      transcripts = transcriptFiles.filter(file => file.endsWith('.vtt'));
    }
    
    // Create mapping
    const mapping = [];
    
    videos.forEach(video => {
      const videoBase = video.replace(/\.[^/.]+$/, "").toLowerCase();
      const videoTitle = videoBase.replace(/_/g, ' ');
      
      // Find matching transcript
      const matchingTranscript = transcripts.find(transcript => {
        const transcriptBase = transcript.replace('.vtt', '').toLowerCase();
        const transcriptTitle = transcriptBase.replace(/_/g, ' ');
        
        // Multiple matching strategies
        const exactMatch = transcriptBase === videoBase;
        const transcriptContainsVideo = transcriptBase.includes(videoBase);
        const videoContainsTranscript = videoBase.includes(transcriptBase);
        const titleSimilarity = transcriptTitle.includes(videoTitle) || videoTitle.includes(transcriptTitle);
        const episodeMatch = videoBase.match(/s\d+e\d+/) && transcriptBase.match(/s\d+e\d+/) &&
                            videoBase.match(/s\d+e\d+/)[0] === transcriptBase.match(/s\d+e\d+/)[0];
        
        const isMatch = exactMatch || transcriptContainsVideo || videoContainsTranscript || titleSimilarity || episodeMatch;
        
        if (isMatch) {
          console.log(`✅ MATCH FOUND: ${video} ↔ ${transcript}`);
          console.log(`   Video base: ${videoBase}`);
          console.log(`   Transcript base: ${transcriptBase}`);
        }
        
        return isMatch;
      });
      
      mapping.push({
        video: {
          filename: video,
          title: videoTitle,
          id: videoBase
        },
        transcript: matchingTranscript ? {
          filename: matchingTranscript,
          title: matchingTranscript.replace('.vtt', '').replace(/_/g, ' '),
          id: matchingTranscript.replace('.vtt', '')
        } : null,
        hasTranscript: !!matchingTranscript,
        confidence: matchingTranscript ? 
          (matchingTranscript.toLowerCase().includes(videoBase) ? 'high' : 'medium') : 
          'none'
      });
    });
    
    // Sort by confidence and video name
    mapping.sort((a, b) => {
      if (a.hasTranscript !== b.hasTranscript) {
        return a.hasTranscript ? -1 : 1;
      }
      return a.video.title.localeCompare(b.video.title);
    });
    
    res.json({
      total: mapping.length,
      withTranscripts: mapping.filter(m => m.hasTranscript).length,
      withoutTranscripts: mapping.filter(m => !m.hasTranscript).length,
      mapping
    });
    
  } catch (error) {
    console.error('Error creating video-transcript mapping:', error);
    res.status(500).json({ error: 'Failed to create mapping' });
  }
});

// Parse transcript content
app.get('/api/transcript/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const transcriptPath = path.join(__dirname, '../Transcripts_Claude_Ready', filename);
    
    if (!await fs.pathExists(transcriptPath)) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    const content = await fs.readFile(transcriptPath, 'utf8');
    const lines = content.split('\n');
    const segments = [];

    for (const line of lines) {
      const match = line.match(/^\[(\d{1,2}:\d{2}:\d{2}(?:\.\d{3})?)\]\s+(.+)$/);
      if (match) {
        const [, timestamp, text] = match;
        const seconds = timeToSeconds(timestamp);
        segments.push({
          timestamp: seconds,
          start: seconds,
          end: seconds + 5,
          text: text.trim(),
          timeString: timestamp
        });
      }
    }

    // Adjust end times
    for (let i = 0; i < segments.length - 1; i++) {
      segments[i].end = segments[i + 1].start;
    }

    res.json(segments);
  } catch (error) {
    console.error('Error parsing transcript:', error);
    res.status(500).json({ error: 'Failed to parse transcript' });
  }
});

// Generate video clip with VIRAL ENHANCEMENTS
app.post('/api/generate-clip', async (req, res) => {
  try {
    const { videoFile, segment, config, viralMode, platform, controversyScore, hooks, quality } = req.body;

    if (!videoFile || !segment || !config) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const inputPath = path.join(__dirname, '..', videoFile);
    const clipId = `${viralMode ? 'VIRAL_' : ''}clip_${Date.now()}`;
    const outputPath = path.join(__dirname, 'clips', `${clipId}.mp4`);

    console.log('🔥 Generating VIRAL clip:', { 
      input: inputPath, 
      output: outputPath, 
      segment, 
      config, 
      platform: platform || 'default',
      viralMode: !!viralMode,
      controversyScore: controversyScore || 0
    });

    // Detect if source is 4K and get video info
    const videoInfo = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });

    const videoStream = videoInfo.streams.find(s => s.codec_type === 'video');
    const sourceWidth = videoStream?.width || 1920;
    const sourceHeight = videoStream?.height || 1080;
    const is4K = sourceWidth >= 3840 || sourceHeight >= 2160;
    const isHDR = videoStream?.color_space === 'bt2020nc' || videoStream?.color_transfer === 'smpte2084';

    console.log(`📹 Source video: ${sourceWidth}x${sourceHeight} ${is4K ? '(4K)' : '(HD)'} ${isHDR ? '(HDR)' : '(SDR)'}`);

    // Build FFmpeg command with 4K optimizations
    let command = ffmpeg(inputPath)
      .seekInput(segment.start)
      .duration(segment.end - segment.start);

    // Quality settings based on user selection and source
    const getQualitySettings = (quality, is4K) => {
      switch (quality) {
        case '4k-max':
          return { preset: 'slow', crf: 15, profile: 'high', level: '5.1' };
        case '4k-high':
          return { preset: 'medium', crf: 18, profile: 'high', level: '4.1' };
        case '4k-balanced':
          return { preset: 'medium', crf: 21, profile: 'high', level: '4.1' };
        case '1080p-high':
          return { preset: 'medium', crf: 20, profile: 'high', level: '4.0' };
        case '1080p-web':
          return { preset: 'fast', crf: 23, profile: 'main', level: '3.1' };
        case 'auto':
        default:
          if (is4K) {
            return { preset: 'medium', crf: 18, profile: 'high', level: '4.1' };
          } else {
            return { preset: 'fast', crf: 23, profile: 'main', level: '3.1' };
          }
      }
    };

    const qualitySettings = getQualitySettings(quality, is4K);

    // Codec selection with quality optimization
    command = command
      .videoCodec('libx264') // Could be 'h264_videotoolbox' on Mac for hardware acceleration
      .audioCodec('aac')
      .outputOptions([
        `-preset ${qualitySettings.preset}`,
        `-crf ${qualitySettings.crf}`,
        `-profile:v ${qualitySettings.profile}`,
        `-level ${qualitySettings.level}`,
        '-movflags +faststart', // Web optimization
        '-pix_fmt yuv420p'      // Compatibility
      ]);

    console.log(`⚙️ Quality settings: ${qualitySettings.preset} preset, CRF ${qualitySettings.crf}, ${qualitySettings.profile} profile`);

    // Apply video filters with 4K support
    const filters = [];

    // Handle aspect ratios with 4K scaling
    switch (config.format) {
      case '1:1':
        if (is4K) {
          filters.push('scale=2160:2160:force_original_aspect_ratio=increase', 'crop=2160:2160');
        } else {
          filters.push('scale=1080:1080:force_original_aspect_ratio=increase', 'crop=1080:1080');
        }
        break;
      case '9:16':
        if (is4K) {
          filters.push('scale=2160:3840:force_original_aspect_ratio=increase', 'crop=2160:3840');
        } else {
          filters.push('scale=1080:1920:force_original_aspect_ratio=increase', 'crop=1080:1920');
        }
        break;
      case '4k-preserve':
        // New option to preserve 4K resolution
        filters.push(`scale=${sourceWidth}:${sourceHeight}:force_original_aspect_ratio=decrease`);
        break;
      case '4k-downscale':
        // Downscale 4K to 1080p for smaller files
        filters.push('scale=1920:1080:force_original_aspect_ratio=decrease');
        break;
      default:
        if (is4K && config.preserve4K !== false) {
          // Preserve 4K by default unless explicitly disabled
          filters.push('scale=3840:2160:force_original_aspect_ratio=decrease');
        } else {
          filters.push('scale=1920:1080:force_original_aspect_ratio=decrease');
        }
    }

    // Add banner if enabled
    if (config.banner?.enabled && config.banner?.text) {
      const bannerText = config.banner.text.replace(/'/g, "'").replace(/"/g, '\\"');
      const scrollSpeed = config.banner.speed || 50;
      
      // Cross-platform font detection
      let fontPath = '';
      const os = require('os');
      const platform = os.platform();
      
      if (platform === 'darwin') {
        fontPath = ':fontfile=/System/Library/Fonts/Arial.ttf';
      } else if (platform === 'win32') {
        fontPath = ':fontfile=C\\\\:/Windows/Fonts/arial.ttf';
      } else {
        // Linux - try common font paths, fallback to no font specification
        const linuxFonts = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/TTF/arial.ttf'];
        for (const font of linuxFonts) {
          if (require('fs').existsSync(font)) {
            fontPath = `:fontfile=${font}`;
            break;
          }
        }
      }
      
      // Improved banner filter with cross-platform font support
      const bannerFilter = `drawtext=text="${bannerText}":fontsize=32:fontcolor=white:x=w-mod(t*${scrollSpeed}\\,w+tw):y=h-text_h-20:shadowcolor=black:shadowx=2:shadowy=2${fontPath}`;
      filters.push(bannerFilter);
      console.log(`🎬 Adding banner filter (platform: ${platform}): ${bannerFilter}`);
    }

    // Add logo if enabled
    if (config.logo?.enabled && config.logo?.data) {
      try {
        // Save logo data to temporary file
        const logoData = config.logo.data.split(',')[1]; // Remove data:image/... prefix
        const logoBuffer = Buffer.from(logoData, 'base64');
        const logoPath = path.join(clipsDir, `temp_logo_${Date.now()}.png`);
        await fs.writeFile(logoPath, logoBuffer);

        // Calculate logo position and size
        let logoX = '10', logoY = '10'; // default top-left
        const logoSize = config.logo.size || 'medium';
        const sizeMap = { small: '0.1', medium: '0.15', large: '0.2', xlarge: '0.25' };
        const sizeRatio = sizeMap[logoSize] || '0.15';
        
        switch (config.logo.position) {
          case 'top-right': logoX = 'W-w-10'; logoY = '10'; break;
          case 'bottom-left': logoX = '10'; logoY = 'H-h-10'; break;
          case 'bottom-right': logoX = 'W-w-10'; logoY = 'H-h-10'; break;
          case 'center': logoX = '(W-w)/2'; logoY = '(H-h)/2'; break;
        }

        const logoOpacity = config.logo.opacity || 0.8;
        const logoFilter = `[0:v]movie='${logoPath}':loop=0[logo];[0:v][logo]overlay=${logoX}:${logoY}:format=auto:alpha=${logoOpacity}[v]`;
        
        // Use complex filter for logo overlay
        command = command.complexFilter([
          `[0:v]${filters.join(',')}[base]`,
          `movie='${logoPath}':loop=0,scale=iw*${sizeRatio}:ih*${sizeRatio}[logo]`,
          `[base][logo]overlay=${logoX}:${logoY}:format=auto:alpha=${logoOpacity}[v]`
        ], ['v']);
        
        // Clean up temp logo file after processing
        setTimeout(() => {
          fs.unlink(logoPath).catch(console.error);
        }, 5000);
        
        filters = []; // Clear filters since they're now in complexFilter
      } catch (error) {
        console.error('Error processing logo:', error);
      }
    }

    if (filters.length > 0) {
      command = command.videoFilters(filters);
    }

    // Execute FFmpeg
    await new Promise((resolve, reject) => {
      command
        .on('end', resolve)
        .on('error', reject)
        .on('progress', (progress) => console.log('Processing: ' + progress.percent + '% done'))
        .save(outputPath);
    });

    const stats = await fs.stat(outputPath);

    res.json({
      success: true,
      clipId,
      clipUrl: `/clips/${clipId}.mp4`,
      duration: segment.end - segment.start,
      format: config.format,
      size: stats.size,
      viralEnhancements: {
        platform: platform || 'default',
        viralMode: !!viralMode,
        controversyScore: controversyScore || 0,
        hooks: hooks || [],
        engagementPrediction: controversyScore > 80 ? '🔥 HIGH VIRAL' : controversyScore > 60 ? '📈 GOOD REACH' : '📊 STEADY',
        message: viralMode ? `🚀 VIRAL CLIP READY! ${controversyScore}/100 controversy score` : '✅ Clip generated successfully'
      }
    });

  } catch (error) {
    console.error('Error generating clip:', error);
    res.status(500).json({ error: 'Failed to generate clip', details: error.message });
  }
});

// Convert recorded music video WebM to MP4
app.post('/api/music-video/render', express.raw({ type: ['video/webm', 'application/octet-stream'], limit: '2gb' }), async (req, res) => {
  try {
    if (!req.body || !req.body.length) {
      return res.status(400).json({ error: 'No video data received' });
    }

    const timestamp = Date.now();
    const inputPath = path.join(__dirname, 'temp', `music-video-${timestamp}.webm`);
    const requestedName = sanitizeFilename(req.headers['x-output-filename']);
    let outputFilename = `${requestedName}.mp4`;
    let outputPath = path.join(__dirname, 'clips', outputFilename);

    if (await fs.pathExists(outputPath)) {
      outputFilename = `${requestedName}-${timestamp}.mp4`;
      outputPath = path.join(__dirname, 'clips', outputFilename);
    }

    await fs.writeFile(inputPath, req.body);

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',
          '-preset medium',
          '-crf 20',
          '-pix_fmt yuv420p',
          '-c:a aac',
          '-b:a 192k'
        ])
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath);
    });

    const stats = await fs.stat(outputPath);

    // Cleanup source WebM after conversion completes (async)
    fs.remove(inputPath).catch(() => {});

    res.json({
      success: true,
      filename: outputFilename,
      url: `/clips/${outputFilename}`,
      size: stats.size
    });
  } catch (error) {
    console.error('Error converting music video:', error);
    res.status(500).json({ error: 'Failed to convert music video', details: error.message });
  }
});

// Get generated clips
app.get('/api/clips', async (req, res) => {
  try {
    const clipsDir = path.join(__dirname, 'clips');
    
    if (!await fs.pathExists(clipsDir)) {
      return res.json([]);
    }
    
    const files = await fs.readdir(clipsDir);
    
    const clips = await Promise.all(
      files
        .filter(file => file.endsWith('.mp4'))
        .map(async (file) => {
          const filePath = path.join(clipsDir, file);
          const stats = await fs.stat(filePath);
          return {
            id: file.replace('.mp4', ''),
            filename: file,
            url: `/clips/${file}`,
            size: stats.size,
            created: stats.birthtime
          };
        })
    );

    res.json(clips.sort((a, b) => new Date(b.created) - new Date(a.created)));
  } catch (error) {
    console.error('Error reading clips:', error);
    res.status(500).json({ error: 'Failed to read clips' });
  }
});

// Social Media API Endpoints
app.post('/api/social-media/post', async (req, res) => {
  try {
    const { account, content, type = 'immediate' } = req.body;
    
    if (!account || !content) {
      return res.status(400).json({ error: 'Account and content are required' });
    }
    
    // Simulate posting to X (Twitter) API
    // In production, this would integrate with the actual X API
    console.log(`📱 Social Media Post Request:`);
    console.log(`Account: ${account}`);
    console.log(`Content: ${content.substring(0, 100)}...`);
    console.log(`Type: ${type}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Return success response
    res.json({
      success: true,
      postId: `post_${Date.now()}`,
      account: account,
      timestamp: new Date().toISOString(),
      message: 'Post published successfully'
    });
    
  } catch (error) {
    console.error('Error posting to social media:', error);
    res.status(500).json({ error: 'Failed to post to social media', details: error.message });
  }
});

app.post('/api/social-media/schedule', async (req, res) => {
  try {
    const { account, content, scheduledFor } = req.body;
    
    if (!account || !content || !scheduledFor) {
      return res.status(400).json({ error: 'Account, content, and scheduled time are required' });
    }
    
    const scheduleDate = new Date(scheduledFor);
    if (scheduleDate <= new Date()) {
      return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }
    
    // In production, this would save to database and set up cron job
    console.log(`📅 Social Media Schedule Request:`);
    console.log(`Account: ${account}`);
    console.log(`Content: ${content.substring(0, 100)}...`);
    console.log(`Scheduled for: ${scheduleDate.toISOString()}`);
    
    res.json({
      success: true,
      scheduleId: `schedule_${Date.now()}`,
      account: account,
      scheduledFor: scheduleDate.toISOString(),
      message: 'Post scheduled successfully'
    });
    
  } catch (error) {
    console.error('Error scheduling social media post:', error);
    res.status(500).json({ error: 'Failed to schedule post', details: error.message });
  }
});

app.get('/api/social-media/accounts', (req, res) => {
  // Return available social media accounts
  res.json({
    accounts: [
      {
        id: 'aaronrday',
        username: '@aaronrday',
        displayName: 'Aaron Day',
        platform: 'x',
        verified: true,
        connected: true // In production, check actual API connection
      },
      {
        id: 'theaarondayshow',
        username: '@theaarondayshow',
        displayName: 'The Aaron Day Show',
        platform: 'x',
        verified: true,
        connected: true
      }
    ]
  });
});

app.get('/api/social-media/stats/:account', (req, res) => {
  const { account } = req.params;
  
  // In production, fetch real stats from X API
  res.json({
    account: account,
    stats: {
      postsToday: Math.floor(Math.random() * 5),
      totalPosts: Math.floor(Math.random() * 1000) + 500,
      followers: account === 'aaronrday' ? 12543 : 8932,
      following: account === 'aaronrday' ? 1234 : 892,
      engagement: `${(Math.random() * 5 + 2).toFixed(1)}%`
    }
  });
});

// Helper function
function timeToSeconds(timeString) {
  const parts = timeString.split(':');
  let seconds = 0;

  if (parts.length === 3) {
    const [hours, minutes, secs] = parts;
    seconds = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(secs);
  } else if (parts.length === 2) {
    const [minutes, secs] = parts;
    seconds = parseInt(minutes) * 60 + parseFloat(secs);
  } else {
    seconds = parseFloat(timeString);
  }

  return Math.round(seconds * 100) / 100;
}

// Start server
const startServer = async () => {
  await ensureDirectories();
  
  app.listen(PORT, () => {
    console.log(`🎬 Local Video Clipper running at http://localhost:${PORT}`);
    console.log('📁 Video files served from parent directory');
    console.log('📄 Transcripts from: ../Transcripts (VTT FILES)');
    console.log('🎞️  Generated clips saved to: ./clips');
  });
};

startServer().catch(console.error);
