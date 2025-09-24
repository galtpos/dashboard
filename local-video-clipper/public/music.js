// Suno Music Integration Functions

// Helper functions (from the original extension)
function formatSRTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

function formatLRCTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const hundredths = Math.floor((seconds % 1) * 100);

    return `[${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}]`;
}

function convertToSRT(alignedWords) {
    return alignedWords
        .map((word, index) => {
            const startTime = formatSRTTime(word.start_s);
            const endTime = formatSRTTime(word.end_s);
            return `${index + 1}\n${startTime} --> ${endTime}\n${word.word}\n`;
        })
        .join('\n');
}

function convertToLRC(alignedWords) {
    return alignedWords
        .map(word => `${formatLRCTime(word.start_s)}${word.word}`)
        .join('\n');
}

function extractSongId(url) {
    const match = url.match(/\/song\/([^\/\?]+)/);
    return match ? match[1] : null;
}

async function fetchAlignedWords(songId, sessionToken) {
    try {
        const response = await fetch(`https://studio-api.prod.suno.com/api/gen/${songId}/aligned_lyrics/v2/`, {
            headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        return data.aligned_words?.length ? data.aligned_words : null;
    } catch (error) {
        console.error('Error fetching aligned words:', error);
        throw error;
    }
}

function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

function showMusicStatus(message, isError = false) {
    const statusDiv = document.getElementById('music-status');
    const statusText = document.getElementById('music-status-text');
    
    statusText.textContent = message;
    statusText.className = `text-sm ${isError ? 'text-red-400' : 'text-neon-gray'}`;
    statusDiv.classList.remove('hidden');
    
    // Auto-hide after 5 seconds for success messages
    if (!isError) {
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 5000);
    }
}

async function downloadLyrics(format) {
    try {
        const sunoUrl = document.getElementById('suno-url').value.trim();
        const sessionToken = document.getElementById('session-token').value.trim();

        if (!sunoUrl) {
            throw new Error('Please enter a Suno song URL');
        }

        if (!sessionToken) {
            throw new Error('Please enter your session token');
        }

        const songId = extractSongId(sunoUrl);
        if (!songId) {
            throw new Error('Invalid Suno URL. Please use format: https://suno.com/song/your-song-id');
        }

        showMusicStatus(`🎵 Fetching lyrics for song: ${songId}...`);

        const alignedWords = await fetchAlignedWords(songId, sessionToken);
        if (!alignedWords || alignedWords.length === 0) {
            throw new Error('No synchronized lyrics found for this song');
        }

        showMusicStatus(`✅ Found ${alignedWords.length} synchronized words. Converting to ${format.toUpperCase()}...`);

        const content = format === 'srt' ? convertToSRT(alignedWords) : convertToLRC(alignedWords);
        const fileName = `${songId}-lyrics.${format}`;

        downloadFile(content, fileName, `text/${format}`);

        showMusicStatus(`🎉 Lyrics downloaded successfully: ${fileName}`);

    } catch (error) {
        console.error('Download error:', error);
        showMusicStatus(`❌ Error: ${error.message}`, true);
    }
}

// Music Video Creator Variables
let currentSrtData = null;
let currentImageData = null;
let currentAudioData = null;
let previewCanvas = null;
let previewCtx = null;
let animationFrame = null;
let audioLoadingInProgress = false; // Prevent loading loops
let activeMediaRecorder = null;
let activeRecordingCleanup = null;

function sanitizeFilename(value) {
    if (!value || typeof value !== 'string') return 'music-video';
    const normalized = value
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^[-_]+|[-_]+$/g, '')
        .trim();
    return normalized || 'music-video';
}

function getDesiredFilenameBase() {
    const input = document.getElementById('video-filename');
    return sanitizeFilename(input ? input.value : 'music-video');
}

async function convertRecordingToMp4(blob, mimeType, baseName) {
    try {
        const safeName = sanitizeFilename(baseName);
        showMusicStatus(`🔁 Converting to MP4: ${safeName}.mp4`);
        const response = await fetch('/api/music-video/render', {
            method: 'POST',
            headers: {
                'Content-Type': 'video/webm',
                'X-Recording-Mime': mimeType || 'video/webm',
                'X-Output-Filename': safeName
            },
            body: blob
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `Server returned ${response.status}`);
        }

        const result = await response.json();
        if (!result.success || !result.url) {
            throw new Error(result.error || 'Conversion failed');
        }

        return result;
    } catch (error) {
        console.error('MP4 conversion failed:', error);
        showMusicStatus(`⚠️ MP4 conversion failed: ${error.message || 'Unknown error'}. Downloading WebM copy.`, true);
        return null;
    }
}

function triggerFileDownload(url, fileName) {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
    }, 0);
}

// Audio Visualizer Variables
let audioContext = null;
let analyser = null;
let dataArray = null;
let source = null;
let frequencyData = null;

// Initialize music functionality
document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners for download buttons
    const downloadSrtBtn = document.getElementById('download-srt');
    const downloadLrcBtn = document.getElementById('download-lrc');

    if (downloadSrtBtn) {
        downloadSrtBtn.addEventListener('click', () => downloadLyrics('srt'));
    }

    if (downloadLrcBtn) {
        downloadLrcBtn.addEventListener('click', () => downloadLyrics('lrc'));
    }

    // Initialize music video creator
    initMusicVideoCreator();

    // Auto-fill URL if it's in the clipboard and looks like a Suno URL
    navigator.clipboard?.readText?.().then(text => {
        if (text && text.includes('suno.com/song/')) {
            const urlInput = document.getElementById('suno-url');
            if (urlInput && !urlInput.value) {
                urlInput.value = text;
            }
        }
    }).catch(() => {
        // Clipboard access failed, ignore silently
    });
});

// Initialize Music Video Creator
function initMusicVideoCreator() {
    console.log('🎵 Initializing Music Video Creator...');
    
    const backgroundImageInput = document.getElementById('background-image');
    const audioFileInput = document.getElementById('audio-file');
    const lyricsFileInput = document.getElementById('lyrics-file');
    const lyricsContentTextarea = document.getElementById('lyrics-content');
    const useDownloadedSrtBtn = document.getElementById('use-downloaded-srt');
    const previewSyncBtn = document.getElementById('preview-sync');
    const generateVideoBtn = document.getElementById('generate-video');
    const loadTestSrtBtn = document.getElementById('load-wedontbow-srt');
    const videoFilenameInput = document.getElementById('video-filename');

    // Debug: Check if elements are found
    console.log('🖼️ Background input found:', !!backgroundImageInput);
    console.log('🎧 Audio input found:', !!audioFileInput);
    console.log('📝 Lyrics input found:', !!lyricsFileInput);

    // Image upload handling
    if (backgroundImageInput) {
        console.log('✅ Adding image upload handler');
        backgroundImageInput.addEventListener('change', handleImageUpload);
        
        // Add drag and drop support
        const imagePreview = document.getElementById('image-preview');
        if (imagePreview) {
            imagePreview.addEventListener('dragover', (e) => {
                e.preventDefault();
                imagePreview.style.borderColor = '#FFC700';
                imagePreview.style.backgroundColor = 'rgba(255, 199, 0, 0.1)';
            });
            
            imagePreview.addEventListener('dragleave', (e) => {
                e.preventDefault();
                imagePreview.style.borderColor = '#FFC700';
                imagePreview.style.backgroundColor = '#222';
            });
            
            imagePreview.addEventListener('drop', (e) => {
                e.preventDefault();
                imagePreview.style.borderColor = '#FFC700';
                imagePreview.style.backgroundColor = '#222';
                
                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type.startsWith('image/')) {
                    // Simulate file input change
                    const fakeEvent = { target: { files: [files[0]] } };
                    handleImageUpload(fakeEvent);
                }
            });
        }
    } else {
        console.error('❌ Background image input not found!');
    }

    // Audio upload handling
    if (audioFileInput) {
        console.log('✅ Adding audio upload handler');
        audioFileInput.addEventListener('change', handleAudioUpload);
    } else {
        console.error('❌ Audio file input not found!');
    }

    // Lyrics file upload handling
    if (lyricsFileInput) {
        console.log('✅ Adding lyrics file upload handler');
        lyricsFileInput.addEventListener('change', handleLyricsFileUpload);
    } else {
        console.error('❌ Lyrics file input not found!');
    }

    // Lyrics content textarea handling
    if (lyricsContentTextarea) {
        lyricsContentTextarea.addEventListener('input', handleLyricsContentChange);
        lyricsContentTextarea.addEventListener('paste', handleLyricsContentChange);
    }

    // Use downloaded SRT button
    if (useDownloadedSrtBtn) {
        useDownloadedSrtBtn.addEventListener('click', useDownloadedSrt);
    }

    // Preview sync button
    if (previewSyncBtn) {
        console.log('✅ Adding click listener to preview sync button');
        previewSyncBtn.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            console.log('🖱️ PREVIEW SYNC BUTTON CLICKED!');
            previewSync();
        });
        
        // Test if button is clickable
        console.log('🔍 Preview sync button check:');
        console.log('  - Button exists:', !!previewSyncBtn);
        console.log('  - Button disabled:', previewSyncBtn.disabled);
        console.log('  - Button style.display:', previewSyncBtn.style.display);
        console.log('  - Button offsetWidth:', previewSyncBtn.offsetWidth);
        console.log('  - Button offsetHeight:', previewSyncBtn.offsetHeight);
        console.log('  - Button innerHTML:', previewSyncBtn.innerHTML);
        
    } else {
        console.error('❌ Preview sync button not found!');
    }

    // Generate video button
    if (generateVideoBtn) {
        generateVideoBtn.addEventListener('click', generateVideo);
    }

    if (loadTestSrtBtn) {
        loadTestSrtBtn.addEventListener('click', loadWeDontBowSRT);
    }

    if (videoFilenameInput) {
        videoFilenameInput.addEventListener('blur', () => {
            videoFilenameInput.value = sanitizeFilename(videoFilenameInput.value);
        });
    }

    // Force preview button
    const forcePreviewBtn = document.getElementById('force-preview');
    if (forcePreviewBtn) {
        forcePreviewBtn.addEventListener('click', function() {
            console.log('⚡ FORCE PREVIEW CLICKED - Skipping audio readiness checks');
            showMusicStatus('⚡ Forcing preview (ignoring audio loading state)...');
            forcePreview();
        });
    }

    // Test uploads button
    const testUploadsBtn = document.getElementById('test-uploads');
    if (testUploadsBtn) {
        testUploadsBtn.addEventListener('click', runFileUploadTest);
    }

    // Show preview button (simple test)
    const showPreviewBtn = document.getElementById('show-preview');
    if (showPreviewBtn) {
        showPreviewBtn.addEventListener('click', function() {
            console.log('👁️ Show preview button clicked');
            const previewArea = document.getElementById('video-preview');
            if (previewArea) {
                previewArea.style.display = 'block';
                console.log('✅ Preview area shown');
                showMusicStatus('👁️ Preview area is now visible');
                
                // Set up a simple canvas
                const canvas = document.getElementById('preview-canvas');
                if (canvas) {
                    canvas.width = 800;
                    canvas.height = 450;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = '#FFC700';
                    ctx.font = '48px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('PREVIEW AREA TEST', canvas.width/2, canvas.height/2);
                    console.log('✅ Test canvas drawn');
                }
            } else {
                console.error('❌ Preview area not found');
                showMusicStatus('❌ Preview area not found', true);
            }
        });
    }

    // Reset all button
    const resetAllBtn = document.getElementById('reset-all');
    if (resetAllBtn) {
        resetAllBtn.addEventListener('click', resetAllData);
    }

    // Initialize canvas - CREATE IT IF IT DOESN'T EXIST
    previewCanvas = document.getElementById('preview-canvas');
    if (!previewCanvas) {
        console.log('🎨 Creating preview canvas and area...');
        // Create the entire preview area
        const previewArea = document.createElement('div');
        previewArea.id = 'video-preview';
        previewArea.style.cssText = 'background: #222 !important; border: 2px solid #FFC700 !important; border-radius: 8px !important; padding: 20px !important; text-align: center; margin-top: 20px; display: block;';
        
        previewArea.innerHTML = `
            <h4 style="color: #FFC700 !important; margin-bottom: 15px;">🎬 VIDEO PREVIEW</h4>
            <canvas id="preview-canvas" width="800" height="450" style="max-width: 100%; border: 1px solid #444; display: block; margin: 0 auto; background: #000;"></canvas>
            
            <div style="margin: 15px 0; display: flex; align-items: center; justify-content: center; gap: 10px;">
                <button id="play-pause-btn" style="padding: 8px 15px; background: #FFC700; color: #000; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
                    ▶️ PLAY
                </button>
                <input type="range" id="audio-scrubber" min="0" max="100" value="0" style="flex: 1; margin: 0 10px;">
                <span style="color: #A0A0A0; font-size: 12px;">🔊</span>
                <input type="range" id="volume-control" min="0" max="1" step="0.1" value="0.7" style="width: 80px;">
            </div>
            
            <div style="color: #D1D1D1;">
                <div id="current-lyric" style="font-size: 18px; font-weight: bold; color: #FFC700; margin-bottom: 10px;">Ready to preview...</div>
                <div id="preview-time" style="font-size: 14px; color: #A0A0A0;">00:00 / 00:00</div>
            </div>
        `;
        
        // Find a good place to insert it
        const musicTab = document.querySelector('#music-tab') || document.body;
        musicTab.appendChild(previewArea);
        
        // Now get the canvas
        previewCanvas = document.getElementById('preview-canvas');
    }
    
    if (previewCanvas) {
        previewCtx = previewCanvas.getContext('2d');
        console.log('✅ Canvas initialized:', previewCanvas.width, 'x', previewCanvas.height);
    } else {
        console.error('❌ Failed to create canvas!');
    }

    // Initialize visualizer controls
    initVisualizerControls();
    
    // Initialize sync controls
    initSyncControls();
    
    // Test file upload functionality
    testFileUploadFunctionality();
}

// Test file upload functionality
// Load the wedontbow.srt file directly
async function loadWeDontBowSRT() {
    try {
        console.log('🎵 Loading wedontbow.srt...');
        const response = await fetch('/wedontbow.srt');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const srtContent = await response.text();
        
        // Set the SRT content
        currentSrtData = srtContent;
        
        // Update the textarea
        const lyricsTextarea = document.getElementById('lyrics-content');
        if (lyricsTextarea) {
            lyricsTextarea.value = srtContent;
        }
        
        console.log('✅ Loaded wedontbow.srt:', srtContent.length, 'characters');
        showMusicStatus('✅ Loaded wedontbow.srt successfully!', 'success');
        
        // Auto-start preview
        previewSync();
        
    } catch (error) {
        console.error('❌ Failed to load wedontbow.srt:', error);
        showMusicStatus('❌ Failed to load wedontbow.srt: ' + error.message, 'error');
    }
}

function testFileUploadFunctionality() {
    console.log('🧪 Testing file upload functionality...');
    
    // Test if all required elements exist
    const requiredElements = [
        'background-image',
        'audio-file', 
        'lyrics-file',
        'lyrics-content',
        'image-preview',
        'audio-preview',
        'audio-info',
        'music-status',
        'music-status-text'
    ];
    
    let allElementsFound = true;
    requiredElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error(`❌ Missing element: ${elementId}`);
            allElementsFound = false;
        } else {
            console.log(`✅ Found element: ${elementId}`);
        }
    });
    
    if (allElementsFound) {
        console.log('✅ All required elements found');
        showMusicStatus('🎵 Music Video Creator ready! Try uploading files.');
    } else {
        console.error('❌ Some required elements are missing');
        showMusicStatus('❌ Setup incomplete - check console for details', true);
    }
}

// Run comprehensive file upload test
function runFileUploadTest() {
    console.log('🧪 Running comprehensive file upload test...');
    showMusicStatus('🔧 Running file upload diagnostics...');
    
    // Test 1: Check all file inputs exist and are clickable
    const fileInputs = [
        { id: 'background-image', name: 'Image Upload' },
        { id: 'audio-file', name: 'Audio Upload' },
        { id: 'lyrics-file', name: 'Lyrics Upload' }
    ];
    
    let testResults = [];
    
    fileInputs.forEach(input => {
        const element = document.getElementById(input.id);
        if (element) {
            // Test if element is visible and clickable
            const rect = element.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            const isEnabled = !element.disabled;
            const hasEventListener = element.onchange !== null || element.addEventListener;
            
            testResults.push({
                name: input.name,
                found: true,
                visible: isVisible,
                enabled: isEnabled,
                hasListener: !!hasEventListener
            });
            
            console.log(`✅ ${input.name}: Found=${true}, Visible=${isVisible}, Enabled=${isEnabled}`);
        } else {
            testResults.push({
                name: input.name,
                found: false,
                visible: false,
                enabled: false,
                hasListener: false
            });
            console.error(`❌ ${input.name}: Element not found`);
        }
    });
    
    // Test 2: Check if FileReader is supported
    const fileReaderSupported = typeof FileReader !== 'undefined';
    console.log('📖 FileReader supported:', fileReaderSupported);
    
    // Test 3: Check if drag and drop is supported
    const dragDropSupported = 'draggable' in document.createElement('div');
    console.log('🖱️ Drag & Drop supported:', dragDropSupported);
    
    // Test 4: Try to trigger a file input click
    const imageInput = document.getElementById('background-image');
    if (imageInput) {
        try {
            // This should work if everything is set up correctly
            console.log('🖱️ Testing file input click simulation...');
            // Don't actually click, just test if we could
            const clickable = typeof imageInput.click === 'function';
            console.log('🖱️ File input clickable:', clickable);
        } catch (error) {
            console.error('❌ File input click test failed:', error);
        }
    }
    
    // Display results
    const allWorking = testResults.every(test => 
        test.found && test.visible && test.enabled
    );
    
    if (allWorking && fileReaderSupported) {
        showMusicStatus('✅ All file upload systems working! Try uploading your files.');
        console.log('🎉 All tests passed! File upload should work correctly.');
    } else {
        const issues = testResults.filter(test => 
            !test.found || !test.visible || !test.enabled
        );
        console.error('❌ Issues found:', issues);
        showMusicStatus('❌ File upload issues detected - check console for details', true);
    }
    
    // Show detailed report
    console.table(testResults);
}

// Reset all data and UI state
function resetAllData() {
    console.log('🔄 Resetting all data and UI state...');
    
    // Show confirmation
    if (!confirm('This will clear all uploaded files and reset the music video creator. Continue?')) {
        return;
    }
    
    // Clean up preview state
    cleanupPreviewState();
    
    // Clear all global data
    currentSrtData = null;
    currentImageData = null;
    currentAudioData = null;
    
    // Clear audio context and visualizer
    if (source) {
        source.disconnect();
        source = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
    }
    audioContext = null;
    analyser = null;
    dataArray = null;
    frequencyData = null;
    
    // Reset all file inputs
    const fileInputs = ['background-image', 'audio-file', 'lyrics-file'];
    fileInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.value = '';
        }
    });
    
    // Reset image preview
    const imagePreview = document.getElementById('image-preview');
    if (imagePreview) {
        imagePreview.style.backgroundImage = 'none';
        imagePreview.textContent = 'Drop image here or select above';
    }
    
    // Reset audio preview and info
    const audioPreview = document.getElementById('audio-preview');
    const audioInfo = document.getElementById('audio-info');
    if (audioPreview) {
        audioPreview.pause();
        audioPreview.src = '';
        audioPreview.hidden = true;
    }
    if (audioInfo) {
        audioInfo.innerHTML = '<div>📁 No audio file selected</div>';
    }
    
    // Reset audio timing inputs
    const audioStart = document.getElementById('audio-start');
    const audioEnd = document.getElementById('audio-end');
    if (audioStart) audioStart.value = '0';
    if (audioEnd) audioEnd.value = '0';
    
    // Reset lyrics content and status
    const lyricsContent = document.getElementById('lyrics-content');
    const lyricsStatus = document.getElementById('lyrics-status');
    if (lyricsContent) {
        lyricsContent.value = '';
    }
    if (lyricsStatus) {
        lyricsStatus.innerHTML = '📝 No lyrics loaded - Upload file, paste content, or download from Suno above';
        lyricsStatus.style.color = '#A0A0A0';
    }
    
    // Reset sync controls
    const lyricOffset = document.getElementById('lyric-offset');
    const playbackSpeed = document.getElementById('playback-speed');
    if (lyricOffset) lyricOffset.value = '0';
    if (playbackSpeed) playbackSpeed.value = '1.0';
    
    // Hide video preview
    const videoPreview = document.getElementById('video-preview');
    if (videoPreview) {
        videoPreview.style.display = 'none';
    }
    
    // Clear canvas
    if (previewCtx && previewCanvas) {
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
    
    showMusicStatus('🔄 All data reset. Ready to start fresh!');
    console.log('✅ Reset complete');
}

// Debug function - can be called from browser console
window.debugPreviewSync = function() {
    console.log('🐛 DEBUG: Manual preview sync test');
    previewSync();
};

// Debug function - can be called from browser console  
window.debugMusicState = function() {
    console.log('🐛 DEBUG: Current music state');
    console.log('  - currentSrtData:', !!currentSrtData, currentSrtData ? `(${currentSrtData.length} chars)` : '');
    console.log('  - currentImageData:', !!currentImageData, currentImageData ? `(${currentImageData.width}x${currentImageData.height})` : '');
    console.log('  - currentAudioData:', !!currentAudioData, currentAudioData ? `(${currentAudioData.length} chars)` : '');
    
    const audioPreview = document.getElementById('audio-preview');
    console.log('  - audioPreview exists:', !!audioPreview);
    if (audioPreview) {
        console.log('  - audioPreview.src:', audioPreview.src);
        console.log('  - audioPreview.readyState:', audioPreview.readyState);
        console.log('  - audioPreview.duration:', audioPreview.duration);
        console.log('  - audioPreview.paused:', audioPreview.paused);
        console.log('  - audioPreview.volume:', audioPreview.volume);
    }
    
    const previewSyncBtn = document.getElementById('preview-sync');
    console.log('  - previewSyncBtn exists:', !!previewSyncBtn);
    if (previewSyncBtn) {
        console.log('  - previewSyncBtn.disabled:', previewSyncBtn.disabled);
        console.log('  - previewSyncBtn.offsetWidth:', previewSyncBtn.offsetWidth);
    }
};

// Debug function to test audio directly
window.testAudio = function() {
    console.log('🎧 TESTING AUDIO DIRECTLY...');
    const audioPreview = document.getElementById('audio-preview');
    if (!audioPreview) {
        console.error('❌ No audio element found');
        return;
    }
    
    console.log('🎧 Audio element found, attempting direct play...');
    console.log('  - src:', audioPreview.src);
    console.log('  - readyState:', audioPreview.readyState);
    console.log('  - paused:', audioPreview.paused);
    
    audioPreview.play().then(() => {
        console.log('✅ AUDIO PLAYING SUCCESSFULLY!');
    }).catch(error => {
        console.error('❌ AUDIO PLAY FAILED:', error);
    });
};

// Initialize visualizer control event listeners
function initVisualizerControls() {
    const sizeSlider = document.getElementById('visualizer-size');
    const sensitivitySlider = document.getElementById('visualizer-sensitivity');
    const opacitySlider = document.getElementById('visualizer-opacity');

    if (sizeSlider) {
        sizeSlider.addEventListener('input', function() {
            const value = this.value;
            this.nextElementSibling.textContent = value + 'px';
        });
    }

    if (sensitivitySlider) {
        sensitivitySlider.addEventListener('input', function() {
            const value = parseFloat(this.value);
            this.nextElementSibling.textContent = value.toFixed(1) + 'x';
        });
    }

    if (opacitySlider) {
        opacitySlider.addEventListener('input', function() {
            const value = Math.round(parseFloat(this.value) * 100);
            this.nextElementSibling.textContent = value + '%';
        });
    }
}

// Initialize sync control event listeners
function initSyncControls() {
    const syncBackwardBtn = document.getElementById('sync-backward');
    const syncForwardBtn = document.getElementById('sync-forward');
    const resetSyncBtn = document.getElementById('reset-sync');
    const playbackSpeedSelect = document.getElementById('playback-speed');
    const offsetInput = document.getElementById('lyric-offset');

    if (syncBackwardBtn) {
        syncBackwardBtn.addEventListener('click', () => adjustSync(-100));
    }

    if (syncForwardBtn) {
        syncForwardBtn.addEventListener('click', () => adjustSync(100));
    }

    if (resetSyncBtn) {
        resetSyncBtn.addEventListener('click', resetSync);
    }

    if (playbackSpeedSelect) {
        playbackSpeedSelect.addEventListener('change', updatePlaybackSpeed);
    }

    if (offsetInput) {
        offsetInput.addEventListener('input', updateSyncStatus);
    }
}

// Adjust sync timing
function adjustSync(deltaMs) {
    const offsetInput = document.getElementById('lyric-offset');
    if (offsetInput) {
        const currentOffset = parseInt(offsetInput.value) || 0;
        const newOffset = currentOffset + deltaMs;
        offsetInput.value = newOffset;
        updateSyncStatus();
        
        // Show feedback
        const syncStatus = document.getElementById('sync-status');
        if (syncStatus) {
            syncStatus.textContent = `Adjusted ${deltaMs > 0 ? '+' : ''}${deltaMs}ms`;
            syncStatus.style.color = deltaMs > 0 ? '#10b981' : '#FF3B3B';
            setTimeout(() => {
                syncStatus.style.color = '#A0A0A0';
                updateSyncStatus();
            }, 1500);
        }
    }
}

// Reset sync to zero
function resetSync() {
    const offsetInput = document.getElementById('lyric-offset');
    const playbackSpeedSelect = document.getElementById('playback-speed');
    
    if (offsetInput) offsetInput.value = '0';
    if (playbackSpeedSelect) playbackSpeedSelect.value = '1.0';
    
    updateSyncStatus();
    updatePlaybackSpeed();
    
    const syncStatus = document.getElementById('sync-status');
    if (syncStatus) {
        syncStatus.textContent = 'Sync reset to default';
        syncStatus.style.color = '#FFC700';
        setTimeout(() => {
            syncStatus.style.color = '#A0A0A0';
            updateSyncStatus();
        }, 1500);
    }
}

// Update sync status display
function updateSyncStatus() {
    const offsetInput = document.getElementById('lyric-offset');
    const syncStatus = document.getElementById('sync-status');
    
    if (offsetInput && syncStatus) {
        const offset = parseInt(offsetInput.value) || 0;
        if (offset === 0) {
            syncStatus.textContent = 'Perfect sync';
        } else if (offset > 0) {
            syncStatus.textContent = `Lyrics +${offset}ms delayed`;
        } else {
            syncStatus.textContent = `Lyrics ${Math.abs(offset)}ms early`;
        }
    }
}

// Update playback speed
function updatePlaybackSpeed() {
    const playbackSpeedSelect = document.getElementById('playback-speed');
    const audioPreview = document.getElementById('audio-preview');
    
    if (playbackSpeedSelect && audioPreview) {
        const speed = parseFloat(playbackSpeedSelect.value) || 1.0;
        audioPreview.playbackRate = speed;
        
        const syncStatus = document.getElementById('sync-status');
        if (syncStatus) {
            syncStatus.textContent = `Playback speed: ${speed}x`;
            syncStatus.style.color = speed === 1.0 ? '#A0A0A0' : '#FFC700';
            setTimeout(() => {
                syncStatus.style.color = '#A0A0A0';
                updateSyncStatus();
            }, 1500);
        }
    }
}

// Handle image upload
function handleImageUpload(event) {
    console.log('🖼️ Image upload triggered');
    const file = event.target.files[0];
    if (!file) {
        console.log('❌ No file selected');
        return;
    }

    console.log('📁 File selected:', file.name, file.type, file.size);
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showMusicStatus('❌ Please select a valid image file', true);
        return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showMusicStatus('❌ Image file too large. Please select a file under 10MB', true);
        return;
    }

    showMusicStatus('🔄 Loading image...');

    const reader = new FileReader();
    reader.onload = function(e) {
        console.log('✅ FileReader loaded image data');
        currentImageData = new Image();
        
        currentImageData.onload = function() {
            console.log('✅ Image loaded:', this.width + 'x' + this.height);
            
            // Update preview
            const preview = document.getElementById('image-preview');
            if (preview) {
                preview.style.backgroundImage = `url(${e.target.result})`;
                preview.style.backgroundSize = 'cover';
                preview.style.backgroundPosition = 'center';
                preview.textContent = '';
                console.log('✅ Preview updated');
            }

            showMusicStatus(`✅ Image loaded: ${file.name} (${this.width}x${this.height})`);
        };
        
        currentImageData.onerror = function() {
            console.error('❌ Failed to load image');
            showMusicStatus('❌ Failed to load image. Please try a different file.', true);
        };
        
        currentImageData.src = e.target.result;
    };
    
    reader.onerror = function() {
        console.error('❌ FileReader error');
        showMusicStatus('❌ Error reading file. Please try again.', true);
    };
    
    reader.readAsDataURL(file);
}

// Handle audio upload
function handleAudioUpload(event) {
    console.log('🎧 Audio upload triggered');
    
    // Clear previous audio data and stop any playing audio
    const audioPreview = document.getElementById('audio-preview');
    if (audioPreview) {
        audioPreview.pause();
        audioPreview.currentTime = 0;
        audioPreview.src = '';
    }
    
    // Clear audio context and visualizer data
    if (source) {
        source.disconnect();
        source = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
        analyser = null;
        dataArray = null;
        frequencyData = null;
    }
    
    // Stop any running preview
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
    
    // Hide video preview
    const videoPreview = document.getElementById('video-preview');
    if (videoPreview) {
        videoPreview.style.display = 'none';
    }
    
    currentAudioData = null;
    audioLoadingInProgress = false; // Reset loading flag
    
    const file = event.target.files[0];
    if (!file) {
        console.log('❌ No audio file selected');
        // Reset audio info display
        const audioInfo = document.getElementById('audio-info');
        if (audioInfo) {
            audioInfo.innerHTML = '<div>📁 No audio file selected</div>';
        }
        return;
    }

    console.log('📁 Audio file selected:', file.name, file.type, file.size);
    
    // Validate file type
    if (!file.type.startsWith('audio/')) {
        showMusicStatus('❌ Please select a valid audio file', true);
        return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
        showMusicStatus('❌ Audio file too large. Please select a file under 50MB', true);
        return;
    }

    showMusicStatus('🔄 Loading audio...');

    const reader = new FileReader();
    reader.onload = function(e) {
        console.log('✅ FileReader loaded audio data');
        const audioPreview = document.getElementById('audio-preview');
        const audioInfo = document.getElementById('audio-info');
        const audioEnd = document.getElementById('audio-end');

        if (audioPreview) {
            audioPreview.src = e.target.result;
            audioPreview.hidden = false;
            
            audioPreview.addEventListener('loadedmetadata', function() {
                if (audioLoadingInProgress) {
                    console.log('⚠️ Audio loading already in progress, skipping...');
                    return;
                }
                audioLoadingInProgress = true;

                const duration = this.duration;
                const minutes = Math.floor(duration / 60);
                const seconds = Math.floor(duration % 60);

                console.log('✅ Audio metadata loaded:', duration + 's');

                // Prepare analyser/visualizer pipeline once metadata is ready
                setupAudioContext(audioPreview);

                if (audioInfo) {
                    audioInfo.innerHTML = `
                        <div>🎵 ${file.name}</div>
                        <div style="color: #A0A0A0; margin-top: 5px;">Duration: ${minutes}:${seconds.toString().padStart(2, '0')}</div>
                    `;
                }

                if (audioEnd) {
                    audioEnd.value = duration.toFixed(1);
                }

                console.log('✅ Audio ready for playback');
                showMusicStatus(`✅ Audio loaded: ${file.name} (${minutes}:${seconds.toString().padStart(2, '0')})`);
                
                audioLoadingInProgress = false;
            });
            
            // Add canplaythrough event for better readiness detection
            audioPreview.addEventListener('canplaythrough', function() {
                console.log('🎧 Audio can play through completely (readyState:', this.readyState, ')');
            }, { once: true });
            
            audioPreview.addEventListener('error', function() {
                console.error('❌ Audio loading error');
                showMusicStatus('❌ Failed to load audio. Please try a different file.', true);
            });
        } else {
            console.error('❌ Audio preview element not found');
        }

        currentAudioData = e.target.result;
    };
    
    reader.onerror = function() {
        console.error('❌ FileReader error for audio');
        showMusicStatus('❌ Error reading audio file. Please try again.', true);
    };
    
    reader.readAsDataURL(file);
}

// Setup audio context for visualization
function setupAudioContext(audioElement) {
    try {
        // Create audio context if it doesn't exist
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Create analyser node
        if (!analyser) {
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 512; // Higher resolution for better visualization
            analyser.smoothingTimeConstant = 0.8;
        }

        // Create source from audio element
        if (source) {
            try {
                source.disconnect();
            } catch (e) {
                console.log('Source already disconnected');
            }
        }
        
        try {
            source = audioContext.createMediaElementSource(audioElement);
            
            // Connect: source -> analyser -> destination
            source.connect(analyser);
            analyser.connect(audioContext.destination);
            console.log('✅ Audio source connected successfully');
        } catch (error) {
            if (error.name === 'InvalidStateError') {
                console.log('⚠️ Audio element already connected, skipping audio context setup');
                // Skip audio context for this element, but continue with preview
                source = null;
                analyser = null;
                return false; // Indicate audio context failed but continue
            } else {
                throw error;
            }
        }

        // Create frequency data array
        const bufferLength = analyser.frequencyBinCount;
        frequencyData = new Uint8Array(bufferLength);
        dataArray = new Uint8Array(bufferLength);

        showMusicStatus('✅ Audio visualizer ready!');
    } catch (error) {
        console.error('Error setting up audio context:', error);
        showMusicStatus('⚠️ Audio visualizer unavailable (browser limitation)', false);
    }
}

// Handle lyrics file upload
function handleLyricsFileUpload(event) {
    console.log('📝 Lyrics file upload triggered');
    const file = event.target.files[0];
    if (!file) {
        console.log('❌ No lyrics file selected');
        return;
    }

    console.log('📁 Lyrics file selected:', file.name, file.type, file.size);
    
    // Validate file extension
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.srt') && !fileName.endsWith('.vtt')) {
        showMusicStatus('❌ Please select a valid SRT or VTT file', true);
        return;
    }

    // Validate file size (max 1MB for text files)
    if (file.size > 1024 * 1024) {
        showMusicStatus('❌ Lyrics file too large. Please select a file under 1MB', true);
        return;
    }

    showMusicStatus('🔄 Loading lyrics...');

    const reader = new FileReader();
    reader.onload = function(e) {
        console.log('✅ FileReader loaded lyrics data');
        const content = e.target.result;
        
        if (!content || content.trim().length === 0) {
            showMusicStatus('❌ Lyrics file appears to be empty', true);
            return;
        }
        
        console.log('📝 Lyrics content length:', content.length);
        currentSrtData = content;
        
        // Update textarea with file content
        const lyricsContent = document.getElementById('lyrics-content');
        if (lyricsContent) {
            lyricsContent.value = content;
            console.log('✅ Textarea updated with lyrics content');
        }

        updateLyricsStatus(file.name, content);
        showMusicStatus(`✅ Lyrics file loaded: ${file.name}`);
    };
    
    reader.onerror = function() {
        console.error('❌ FileReader error for lyrics');
        showMusicStatus('❌ Error reading lyrics file. Please try again.', true);
    };
    
    reader.readAsText(file);
}

// Handle lyrics content textarea changes
function handleLyricsContentChange(event) {
    const content = event.target.value.trim();
    
    if (content) {
        currentSrtData = content;
        updateLyricsStatus('Manual Input', content);
        showMusicStatus('✅ Lyrics content updated');
    } else {
        currentSrtData = null;
        updateLyricsStatus();
    }
}

// Use downloaded SRT data
function useDownloadedSrt() {
    if (!currentSrtData) {
        // If no SRT data, suggest loading the wedontbow.srt file
        showMusicStatus('💡 No SRT data available. Try uploading your wedontbow.srt file above, or download lyrics first.', false);
        
        // Highlight the file upload area briefly
        const lyricsFileInput = document.getElementById('lyrics-file');
        if (lyricsFileInput) {
            lyricsFileInput.style.borderColor = '#FFC700';
            lyricsFileInput.style.boxShadow = '0 0 10px rgba(255, 199, 0, 0.5)';
            
            setTimeout(() => {
                lyricsFileInput.style.borderColor = '#FFC700';
                lyricsFileInput.style.boxShadow = 'none';
            }, 3000);
        }
        return;
    }

    // Fill textarea with downloaded SRT
    const lyricsContent = document.getElementById('lyrics-content');
    if (lyricsContent) {
        lyricsContent.value = currentSrtData;
        handleLyricsContentChange({ target: lyricsContent }); // Trigger the change handler
    }

    updateLyricsStatus('Downloaded SRT', currentSrtData);
    showMusicStatus('✅ Using downloaded SRT data');
}

// Update lyrics status display
function updateLyricsStatus(source = null, content = null) {
    const lyricsStatus = document.getElementById('lyrics-status');
    if (!lyricsStatus) return;

    if (!source || !content) {
        lyricsStatus.innerHTML = '📝 No lyrics loaded - Upload file, paste content, or download from Suno above';
        lyricsStatus.style.color = '#A0A0A0';
        return;
    }

    // Parse lyrics to get count
    const lines = content.split('\n').filter(line => line.trim());
    const timestampLines = lines.filter(line => line.includes('-->'));
    const lyricCount = timestampLines.length;

    // Detect format
    const isVTT = content.includes('WEBVTT') || content.includes('.vtt');
    const format = isVTT ? 'VTT' : 'SRT';

    lyricsStatus.innerHTML = `
        ✅ <strong>${format}</strong> loaded from <strong>${source}</strong><br>
        📊 ${lyricCount} lyric segments • ${lines.length} total lines
    `;
    lyricsStatus.style.color = '#FFC700';
}

// Clean up any existing preview state
function cleanupPreviewState() {
    console.log('🧹 Cleaning up preview state...');

    if (activeRecordingCleanup) {
        activeRecordingCleanup();
        activeRecordingCleanup = null;
        activeMediaRecorder = null;
    }

    // Stop any running animation
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
    
    // Stop and reset audio
    const audioPreview = document.getElementById('audio-preview');
    if (audioPreview) {
        audioPreview.pause();
        audioPreview.currentTime = 0;
    }
    
    // Clear canvas
    if (previewCtx && previewCanvas) {
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
    
    // Reset preview display
    const currentLyricDiv = document.getElementById('current-lyric');
    const previewTimeDiv = document.getElementById('preview-time');
    if (currentLyricDiv) currentLyricDiv.textContent = 'Ready to preview...';
    if (previewTimeDiv) previewTimeDiv.textContent = '00:00 / 00:00';
}

// Shared preview preparation used by preview and render flows
function preparePreview(options = {}) {
    const {
        autoplay = true,
        statusMessage = null,
        allowMissingImage = true
    } = options;

    if (!previewCanvas || !previewCtx) {
        console.error('❌ No canvas available!');
        showMusicStatus('❌ Preview canvas not ready. Reload the page and try again.', true);
        return null;
    }

    if (!currentSrtData) {
        const lyricsTextarea = document.getElementById('lyrics-content');
        if (lyricsTextarea && lyricsTextarea.value.trim()) {
            currentSrtData = lyricsTextarea.value.trim();
            console.log('✅ Using SRT from textarea');
        }
    }

    if (!currentSrtData) {
        showMusicStatus('❌ Load SRT/VTT lyrics before proceeding.', true);
        return null;
    }

    const audioPreview = document.getElementById('audio-preview');
    if (!audioPreview || (!currentAudioData && !audioPreview.src)) {
        showMusicStatus('❌ Upload an audio track before proceeding.', true);
        return null;
    }

    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }

    try {
        audioPreview.pause();
    } catch (error) {
        console.warn('⚠️ Unable to pause audio before restart:', error);
    }

    const startTimeSeconds = parseFloat(document.getElementById('audio-start')?.value) || 0;
    audioPreview.currentTime = startTimeSeconds;

    const width = parseInt(document.getElementById('video-width')?.value) || 1920;
    const height = parseInt(document.getElementById('video-height')?.value) || 1080;
    previewCanvas.width = width;
    previewCanvas.height = height;
    console.log('✅ Starting preview with canvas:', width, 'x', height);

    if (!currentImageData && !allowMissingImage) {
        showMusicStatus('❌ Upload a background image before generating the video.', true);
        return null;
    }

    if (!currentImageData) {
        console.warn('⚠️ No background image loaded. Using solid background.');
    }

    const previewArea = document.getElementById('video-preview');
    if (previewArea) {
        previewArea.style.display = 'block';
    }

    setupPreviewControls();

    if (!analyser || !frequencyData) {
        const audioContextResult = setupAudioContext(audioPreview);
        if (audioContextResult === false) {
            console.warn('⚠️ Audio context not initialized (browser limitation). Visualizer disabled.');
        }
    }

    startPreview({ autoplay });

    if (statusMessage) {
        showMusicStatus(statusMessage);
    }

    return { audioPreview, width, height, startTimeSeconds };
}

// Preview sync functionality
function previewSync() {
    console.log('🎵 PREVIEW SYNC CLICKED!');
    preparePreview({
        autoplay: true,
        statusMessage: '🎬 Preview running! Use the play button to start audio if it is paused.'
    });
}

// Simple preview loop that actually works
function startPreviewLoop() {
    console.log('🎬 Starting preview loop...');
    
    let frameCount = 0;
    const lyrics = parseSrtForPreview();
    console.log('📝 Parsed lyrics:', lyrics.length, 'segments');
    console.log('📝 First few lyrics:', lyrics.slice(0, 10));
    console.log('📝 Current SRT data length:', currentSrtData ? currentSrtData.length : 'No SRT data');
    
    // Debug what we're actually getting
    if (lyrics.length > 0) {
        console.log('📝 Sample lyric objects:', lyrics.slice(0, 5).map(l => ({
            text: l.text,
            word: l.word,
            hasText: !!l.text,
            hasWord: !!l.word
        })));
    }
    
    function drawFrame() {
        if (!previewCanvas || !previewCtx) return;
        
        // Clear canvas
        previewCtx.fillStyle = '#000000';
        previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
        
        // Draw simple test content
        previewCtx.fillStyle = '#FFC700';
        previewCtx.font = 'bold 48px Arial';
        previewCtx.textAlign = 'center';
        
        // Get current text position setting
        const textPosition = document.getElementById('text-position')?.value || 'bottom';
        let y;
        
        switch (textPosition) {
            case 'top':
                y = 80;
                break;
            case 'center':
                y = previewCanvas.height / 2;
                break;
            case 'bottom':
            default:
                y = previewCanvas.height - 80;
                break;
        }
        
        // Draw test text that changes position
        const testText = `Position: ${textPosition.toUpperCase()} - Frame ${frameCount}`;
        previewCtx.fillText(testText, previewCanvas.width / 2, y);
        
        // Draw current lyric if available
        if (lyrics.length > 0) {
            const lyricIndex = Math.floor(frameCount / 60) % lyrics.length;
            const currentLyric = lyrics[lyricIndex];
            
            previewCtx.font = 'bold 32px Arial';
            previewCtx.fillStyle = '#FF57B2';
            const lyricText = currentLyric.text || currentLyric.word || `Empty lyric (${JSON.stringify(currentLyric)})`;
            previewCtx.fillText(lyricText, previewCanvas.width / 2, y + 60);
            
            if (frameCount % 60 === 0) { // Log every second
                console.log('🎵 Drawing lyric:', lyricText, 'from index', lyricIndex, 'object:', currentLyric);
            }
        } else {
            // Draw fallback text
            previewCtx.font = 'bold 32px Arial';
            previewCtx.fillStyle = '#FF57B2';
            previewCtx.fillText('Your SRT lyrics will appear here', previewCanvas.width / 2, y + 60);
        }
        
        // Update current lyric display
        const currentLyricDiv = document.getElementById('current-lyric');
        if (currentLyricDiv) {
            currentLyricDiv.textContent = `${textPosition} positioning - Frame ${frameCount}`;
        }
        
        frameCount++;
        
        // Continue animation
        animationFrame = requestAnimationFrame(drawFrame);
    }
    
    // Start the animation
    drawFrame();
}

// Force preview - skip audio readiness checks
function forcePreview() {
    console.log('⚡ FORCE PREVIEW - Bypassing all checks');
    
    // Clean up any existing state first
    cleanupPreviewState();
    
    if (!currentSrtData) {
        showMusicStatus('❌ Need SRT lyrics to preview', true);
        return;
    }

    if (!currentImageData) {
        showMusicStatus('❌ Need background image to preview', true);
        return;
    }

    if (!currentAudioData) {
        showMusicStatus('❌ Need audio file to preview', true);
        return;
    }

    console.log('⚡ Forcing preview with current data...');

    const prepared = preparePreview({
        autoplay: true,
        statusMessage: '⚡ Force preview started - audio may not sync perfectly',
        allowMissingImage: false
    });

    if (!prepared) {
        console.warn('⚠️ Force preview failed to initialize.');
    }
}

// Setup preview controls (play/pause, scrubber, volume)
function setupPreviewControls() {
    const audioPreview = document.getElementById('audio-preview');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const audioScrubber = document.getElementById('audio-scrubber');
    const volumeControl = document.getElementById('volume-control');
    
    console.log('🎛️ Setting up preview controls...');
    console.log('  - audioPreview:', !!audioPreview);
    console.log('  - audioPreview.src:', audioPreview?.src || 'none');
    console.log('  - audioPreview.readyState:', audioPreview?.readyState);
    console.log('  - playPauseBtn:', !!playPauseBtn);
    
    if (!audioPreview) {
        console.error('❌ Audio preview element not found for controls');
        return;
    }
    
    // Clear any existing event listeners
    let newPlayPauseBtn = playPauseBtn;
    if (playPauseBtn && playPauseBtn.parentNode) {
        newPlayPauseBtn = playPauseBtn.cloneNode(true);
        playPauseBtn.parentNode.replaceChild(newPlayPauseBtn, playPauseBtn);
    }

    // Play/Pause button
    if (newPlayPauseBtn) {
        newPlayPauseBtn.addEventListener('click', function() {
            console.log('🖱️ Play button clicked, audio paused:', audioPreview.paused);
            console.log('🖱️ Audio src:', audioPreview.src);
            console.log('🖱️ Audio readyState:', audioPreview.readyState);
            
            if (audioPreview.paused) {
                console.log('▶️ Attempting to play audio...');
                audioPreview.play().then(() => {
                    newPlayPauseBtn.textContent = '⏸️ PAUSE';
                    console.log('✅ Audio playing successfully');
                    showMusicStatus('▶️ Audio playing');
                }).catch(error => {
                    console.error('❌ Play failed:', error);
                    showMusicStatus(`❌ Play failed: ${error.message}`, true);
                });
            } else {
                audioPreview.pause();
                newPlayPauseBtn.textContent = '▶️ PLAY';
                console.log('⏸️ Audio paused');
                showMusicStatus('⏸️ Audio paused');
            }
        });
        
        // Update button text when audio ends
        audioPreview.addEventListener('ended', function() {
            newPlayPauseBtn.textContent = '▶️ PLAY';
            console.log('🔚 Audio ended');
        });
        
        console.log('✅ Play button event listener added');
    }
    
    // Audio scrubber
    if (audioScrubber) {
        audioScrubber.addEventListener('input', function() {
            const seekTime = (audioPreview.duration * this.value) / 100;
            audioPreview.currentTime = seekTime;
        });
        
        // Update scrubber as audio plays
        audioPreview.addEventListener('timeupdate', function() {
            if (audioPreview.duration) {
                const progress = (audioPreview.currentTime / audioPreview.duration) * 100;
                audioScrubber.value = progress;
            }
        });
    }
    
    // Volume control
    if (volumeControl) {
        volumeControl.addEventListener('input', function() {
            audioPreview.volume = this.value;
        });
        
        // Set initial volume
        audioPreview.volume = volumeControl.value;
    }
    
    console.log('🎛️ Preview controls set up');
}

// Start preview with sync
function startPreview(options = {}) {
    const { autoplay = true } = options;

    const audioPreview = document.getElementById('audio-preview');
    const currentLyricDiv = document.getElementById('current-lyric');
    const previewTimeDiv = document.getElementById('preview-time');

    if (!audioPreview) return;

    const lyrics = parseSrtForPreview();

    const updatePreview = () => {
        const currentTimeMs = audioPreview.currentTime * 1000;
        const offset = parseInt(document.getElementById('lyric-offset').value) || 0;
        const adjustedTime = currentTimeMs + offset;

        const currentLyric = lyrics.find(lyric =>
            adjustedTime >= lyric.start && adjustedTime <= lyric.end
        );

        if (currentLyricDiv) {
            currentLyricDiv.textContent = currentLyric ? currentLyric.text : '...';
        }

        if (previewTimeDiv) {
            const current = formatTime(audioPreview.currentTime);
            const total = formatTime(audioPreview.duration || 0);
            previewTimeDiv.textContent = `${current} / ${total}`;
        }

        drawPreviewFrame(currentLyric);

        if (audioPreview.ended) {
            animationFrame = null;
            return;
        }

        animationFrame = requestAnimationFrame(updatePreview);
    };

    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }

    updatePreview();

    if (autoplay) {
        const playPromise = audioPreview.play();
        if (playPromise && typeof playPromise.then === 'function') {
            playPromise.catch(error => {
                console.warn('⚠️ Browser blocked autoplay:', error?.message || error);
            });
        }
    }

    if (audioPreview.__previewPlayHandler) {
        audioPreview.removeEventListener('play', audioPreview.__previewPlayHandler);
    }

    const playHandler = () => {
        if (!animationFrame) {
            updatePreview();
        }
    };

    audioPreview.__previewPlayHandler = playHandler;
    audioPreview.addEventListener('play', playHandler);
}

// Draw preview frame
function drawPreviewFrame(currentLyric) {
    if (!previewCtx || !previewCanvas) return;

    const width = previewCanvas.width;
    const height = previewCanvas.height;

    // Clear canvas
    previewCtx.clearRect(0, 0, width, height);

    if (currentImageData && currentImageData.complete) {
        previewCtx.drawImage(currentImageData, 0, 0, width, height);
    } else {
        // Fallback background when no image is provided
        previewCtx.fillStyle = '#000000';
        previewCtx.fillRect(0, 0, width, height);

        const gradient = previewCtx.createLinearGradient(0, height * 0.6, 0, height);
        gradient.addColorStop(0, 'rgba(255, 199, 0, 0.05)');
        gradient.addColorStop(1, 'rgba(255, 87, 178, 0.15)');
        previewCtx.fillStyle = gradient;
        previewCtx.fillRect(0, height * 0.6, width, height * 0.4);
    }

    // Draw audio visualizer
    drawAudioVisualizer(width, height);

    // Draw lyric text if available
    if (currentLyric && (currentLyric.text?.trim() || currentLyric.lines)) {
        const fontSize = parseInt(document.getElementById('font-size').value) || 48;
        const textPosition = document.getElementById('text-position').value || 'bottom';
        const textStyle = document.getElementById('text-style').value || 'bold';
        const displayMode = document.getElementById('lyric-display-mode')?.value || 'line';
        
        // DEBUG: Log text positioning
        console.log('🎯 TEXT POSITIONING DEBUG:');
        console.log('  - textPosition:', textPosition);
        console.log('  - fontSize:', fontSize);
        console.log('  - textStyle:', textStyle);
        console.log('  - displayMode:', displayMode);
        
        previewCtx.font = `bold ${fontSize}px Arial`;
        previewCtx.textAlign = 'center';

        if (displayMode === 'verse' && currentLyric.isVerse) {
            // Spotify-style verse display
            drawVerseBlock(currentLyric, width, height, fontSize, textPosition, textStyle);
        } else {
            // Traditional line-by-line display
            drawTraditionalLines(currentLyric, width, height, fontSize, textPosition, textStyle);
        }
    }
}

// Draw Spotify-style verse block
function drawVerseBlock(currentVerse, width, height, fontSize, textPosition, textStyle) {
    const lines = currentVerse.lines || [];
    if (lines.length === 0) return;

    // Auto-adjust font size to fit canvas and number of lines
    const maxLines = Math.max(4, lines.length);
    const maxFontSize = Math.min(fontSize, (height - 100) / (maxLines * 1.4));
    const adjustedFontSize = Math.max(24, Math.min(maxFontSize, 72)); // Between 24px and 72px
    
    const lineHeight = adjustedFontSize * 1.4;
    const totalHeight = lines.length * lineHeight;
    const margin = 40;
    const x = width / 2;
    
    // Calculate starting Y position with bounds checking
    let startY;
    console.log('🎯 VERSE BLOCK positioning for:', textPosition);
    switch (textPosition) {
        case 'top':
            startY = margin + adjustedFontSize;
            console.log('🎯 VERSE TOP: startY =', startY);
            break;
        case 'center':
            startY = Math.max(margin + adjustedFontSize, (height - totalHeight) / 2 + adjustedFontSize);
            console.log('🎯 VERSE CENTER: startY =', startY, '(height =', height, ', totalHeight =', totalHeight, ')');
            break;
        case 'bottom':
        default:
            startY = Math.max(margin + adjustedFontSize, height - totalHeight - margin + adjustedFontSize);
            console.log('🎯 VERSE BOTTOM: startY =', startY, '(height =', height, ', totalHeight =', totalHeight, ')');
            break;
    }
    
    // Ensure text doesn't go off the bottom
    if (startY + totalHeight > height - margin) {
        console.log('🎯 VERSE BOUNDS CHECK: Adjusting startY from', startY, 'to', height - totalHeight - margin + adjustedFontSize);
        startY = height - totalHeight - margin + adjustedFontSize;
    } else {
        console.log('🎯 VERSE BOUNDS CHECK: No adjustment needed, startY =', startY);
    }

    // Find which line should be highlighted based on current time
    const audioPreview = document.getElementById('audio-preview');
    const currentTime = audioPreview ? audioPreview.currentTime * 1000 : 0;
    const offset = parseInt(document.getElementById('lyric-offset')?.value) || 0;
    const adjustedTime = currentTime + offset;

    // Draw each line in the verse
    lines.forEach((line, index) => {
        const y = startY + (index * lineHeight);
        const isCurrentLine = adjustedTime >= line.start && adjustedTime <= line.end;
        
        // Set opacity and styling based on whether this is the current line
        const originalAlpha = previewCtx.globalAlpha;
        
        if (isCurrentLine) {
            // Highlight current line
            previewCtx.globalAlpha = 1.0;
            
            // Add subtle background highlight - use adjusted font size
            previewCtx.font = `${adjustedFontSize}px Arial`;
            const textWidth = previewCtx.measureText(line.text).width;
            previewCtx.fillStyle = 'rgba(255, 199, 0, 0.2)';
            previewCtx.fillRect(x - textWidth/2 - 20, y - adjustedFontSize + 10, textWidth + 40, adjustedFontSize + 10);
            
            applyTextStyle(previewCtx, line.text, x, y, textStyle, adjustedFontSize);
        } else {
            // Non-current lines - dimmed
            previewCtx.globalAlpha = 0.5;
            applyTextStyle(previewCtx, line.text, x, y, 'bold', adjustedFontSize * 0.9);
        }
        
        previewCtx.globalAlpha = originalAlpha;
    });
}

// Draw traditional line-by-line display
function drawTraditionalLines(currentLyric, width, height, fontSize, textPosition, textStyle) {
    const previewLines = parseInt(document.getElementById('preview-lines')?.value) || 1;
    const lyrics = parseSrtForPreview();
    const currentIndex = lyrics.findIndex(lyric => 
        lyric.start === currentLyric.start && lyric.end === currentLyric.end
    );

    // Auto-adjust font size based on text length and canvas size
    const maxTextLength = Math.max(
        currentLyric.text?.length || 0,
        ...(lyrics.slice(Math.max(0, currentIndex - 1), currentIndex + 2).map(l => l.text?.length || 0))
    );
    const adjustedFontSize = Math.min(fontSize, Math.max(24, (width - 100) / (maxTextLength * 0.6)));

    const linesToDraw = [];
    
    if (previewLines === 1) {
        // Current line only
        linesToDraw.push({
            text: currentLyric.text?.trim() || '',
            opacity: 1.0,
            isCurrent: true
        });
    } else if (previewLines === 2) {
        // Current + Next
        linesToDraw.push({
            text: currentLyric.text?.trim() || '',
            opacity: 1.0,
            isCurrent: true
        });
        if (currentIndex >= 0 && currentIndex < lyrics.length - 1) {
            linesToDraw.push({
                text: lyrics[currentIndex + 1].text?.trim() || '',
                opacity: 0.6,
                isCurrent: false
            });
        }
    } else if (previewLines === 3) {
        // Previous + Current + Next
        if (currentIndex > 0) {
            linesToDraw.push({
                text: lyrics[currentIndex - 1].text?.trim() || '',
                opacity: 0.4,
                isCurrent: false
            });
        }
        linesToDraw.push({
            text: currentLyric.text?.trim() || '',
            opacity: 1.0,
            isCurrent: true
        });
        if (currentIndex >= 0 && currentIndex < lyrics.length - 1) {
            linesToDraw.push({
                text: lyrics[currentIndex + 1].text?.trim() || '',
                opacity: 0.6,
                isCurrent: false
            });
        }
    }

    // Calculate positions for multi-line text
    const lineHeight = adjustedFontSize * 1.4;
    const totalHeight = linesToDraw.length * lineHeight;
    const margin = 40;
    let startY;

    switch (textPosition) {
        case 'top':
            startY = margin + adjustedFontSize;
            console.log('🎯 TOP positioning: startY =', startY);
            break;
        case 'center':
            startY = Math.max(margin + adjustedFontSize, (height - totalHeight) / 2 + adjustedFontSize);
            console.log('🎯 CENTER positioning: startY =', startY, '(height =', height, ', totalHeight =', totalHeight, ')');
            break;
        case 'bottom':
        default:
            startY = Math.max(margin + adjustedFontSize, height - totalHeight - margin + adjustedFontSize);
            console.log('🎯 BOTTOM positioning: startY =', startY, '(height =', startY, ', totalHeight =', totalHeight, ')');
            break;
    }

    // Ensure text doesn't go off screen
    if (startY + totalHeight > height - margin) {
        console.log('🎯 BOUNDS CHECK: Adjusting startY from', startY, 'to', height - totalHeight - margin + adjustedFontSize);
        startY = height - totalHeight - margin + adjustedFontSize;
    } else {
        console.log('🎯 BOUNDS CHECK: No adjustment needed, startY =', startY);
    }

    const x = width / 2;

    // Draw each line
    linesToDraw.forEach((line, index) => {
        const y = startY + (index * lineHeight);
        
        // Set opacity for non-current lines
        const originalAlpha = previewCtx.globalAlpha;
        previewCtx.globalAlpha *= line.opacity;
        
        // Highlight current line
        if (line.isCurrent) {
            applyTextStyle(previewCtx, line.text, x, y, textStyle, adjustedFontSize);
        } else {
            // Use simpler style for non-current lines
            applyTextStyle(previewCtx, line.text, x, y, 'bold', adjustedFontSize * 0.9);
        }
        
        // Restore original alpha
        previewCtx.globalAlpha = originalAlpha;
    });
}

// Wrap text to fit within canvas width
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

// Apply different text styles
function applyTextStyle(ctx, text, x, y, style, fontSize) {
    // Handle text wrapping for very long text
    ctx.font = `${fontSize}px Arial`;
    const maxWidth = ctx.canvas.width - 80; // 40px margin on each side
    const wrappedLines = wrapText(ctx, text, maxWidth);
    
    // If text needs wrapping, draw multiple lines
    if (wrappedLines.length > 1) {
        const lineHeight = fontSize * 1.2;
        const startY = y - ((wrappedLines.length - 1) * lineHeight / 2);
        
        wrappedLines.forEach((line, index) => {
            const lineY = startY + (index * lineHeight);
            applySingleLineTextStyle(ctx, line, x, lineY, style, fontSize);
        });
        return;
    }
    
    // Single line - use original function
    applySingleLineTextStyle(ctx, text, x, y, style, fontSize);
}

// Apply text style to a single line
function applySingleLineTextStyle(ctx, text, x, y, style, fontSize) {
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    switch (style) {
        case 'outline':
            // White text with black outline
            ctx.lineWidth = Math.max(2, fontSize / 16);
            ctx.strokeStyle = '#000000';
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeText(text, x, y);
            ctx.fillText(text, x, y);
            break;
            
        case 'shadow':
            // Drop shadow effect
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillText(text, x + 3, y + 3);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(text, x, y);
            break;
            
        case 'glow':
            // Neon glow effect
            ctx.shadowColor = '#FFC700';
            ctx.shadowBlur = fontSize / 4;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(text, x, y);
            
            // Add extra glow layers
            ctx.shadowBlur = fontSize / 8;
            ctx.shadowColor = '#FF57B2';
            ctx.fillText(text, x, y);
            
            // Reset shadow
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            break;
            
        case 'bold':
        default:
            // Simple bold white text with subtle outline
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeText(text, x, y);
            ctx.fillText(text, x, y);
            break;
    }
}

// Draw audio visualizer
function drawAudioVisualizer(canvasWidth, canvasHeight) {
    const visualizerType = document.getElementById('visualizer-type').value;
    
    if (visualizerType === 'none' || !analyser || !frequencyData) {
        return;
    }

    // Get frequency data
    analyser.getByteFrequencyData(frequencyData);

    // Get visualizer settings
    const position = document.getElementById('visualizer-position').value;
    const size = parseInt(document.getElementById('visualizer-size').value) || 80;
    const sensitivity = parseFloat(document.getElementById('visualizer-sensitivity').value) || 1.5;
    const opacity = parseFloat(document.getElementById('visualizer-opacity').value) || 0.8;
    const colorTheme = document.getElementById('visualizer-color').value;
    const barsCount = parseInt(document.getElementById('visualizer-bars').value) || 64;

    // Set global alpha for transparency
    previewCtx.globalAlpha = opacity;

    switch (visualizerType) {
        case 'bars':
            drawFrequencyBars(canvasWidth, canvasHeight, position, size, sensitivity, colorTheme, barsCount);
            break;
        case 'waveform':
            drawWaveform(canvasWidth, canvasHeight, position, size, sensitivity, colorTheme);
            break;
        case 'circle':
            drawCircularVisualizer(canvasWidth, canvasHeight, size, sensitivity, colorTheme, barsCount, position);
            break;
        case 'spiral':
            drawSpiralVisualizer(canvasWidth, canvasHeight, size, sensitivity, colorTheme, barsCount, position);
            break;
        case 'particles':
            drawParticleVisualizer(canvasWidth, canvasHeight, size, sensitivity, colorTheme, position);
            break;
        case 'pulse':
            drawPulseRingVisualizer(canvasWidth, canvasHeight, size, sensitivity, colorTheme, position);
            break;
        case 'spectrum':
            drawSpectrumVisualizer(canvasWidth, canvasHeight, position, size, sensitivity, colorTheme, barsCount);
            break;
        case 'wave3d':
            draw3DWaveVisualizer(canvasWidth, canvasHeight, position, size, sensitivity, colorTheme);
            break;
    }

    // Reset global alpha
    previewCtx.globalAlpha = 1.0;
}

// Draw frequency bars visualizer
function drawFrequencyBars(canvasWidth, canvasHeight, position, size, sensitivity, colorTheme, barsCount) {
    const positionData = calculateVisualizerPosition(position, canvasWidth, canvasHeight, size);
    
    // For side positions, adjust bar layout
    const isVerticalSide = position.includes('left') || position.includes('right');
    const isHorizontalSide = position.includes('top') || position.includes('bottom');
    
    if (isVerticalSide && !position.includes('center')) {
        // Draw vertical bars for left/right positions
        drawVerticalBars(positionData, size, sensitivity, colorTheme, barsCount);
    } else {
        // Draw horizontal bars for top/bottom/center positions
        drawHorizontalBars(positionData, canvasWidth, canvasHeight, size, sensitivity, colorTheme, barsCount, position);
    }
}

// Draw horizontal frequency bars
function drawHorizontalBars(positionData, canvasWidth, canvasHeight, size, sensitivity, colorTheme, barsCount, position) {
    const barWidth = positionData.width / barsCount;
    const dataStep = Math.floor(frequencyData.length / barsCount);

    for (let i = 0; i < barsCount; i++) {
        const dataIndex = i * dataStep;
        const amplitude = frequencyData[dataIndex] * sensitivity;
        const barHeight = Math.min(amplitude * size / 256, size);

        const x = positionData.x + (i * barWidth);
        let y, rectHeight;

        if (position === 'overlay') {
            y = canvasHeight - barHeight;
            rectHeight = barHeight;
        } else if (position.includes('top')) {
            y = positionData.y;
            rectHeight = barHeight;
        } else if (position.includes('bottom')) {
            y = positionData.y - barHeight;
            rectHeight = barHeight;
        } else {
            // Center positions
            y = positionData.y - (barHeight / 2);
            rectHeight = barHeight;
        }

        // Set color based on theme
        previewCtx.fillStyle = getVisualizerColor(colorTheme, i, barsCount, amplitude);
        previewCtx.fillRect(x, y, barWidth - 2, rectHeight);
    }
}

// Draw vertical frequency bars for side positions
function drawVerticalBars(positionData, size, sensitivity, colorTheme, barsCount) {
    const barHeight = positionData.height / barsCount;
    const dataStep = Math.floor(frequencyData.length / barsCount);

    for (let i = 0; i < barsCount; i++) {
        const dataIndex = i * dataStep;
        const amplitude = frequencyData[dataIndex] * sensitivity;
        const barWidth = Math.min(amplitude * size / 256, size);

        const y = positionData.y + (i * barHeight);
        const x = positionData.isLeft ? positionData.x : positionData.x - barWidth;

        // Set color based on theme
        previewCtx.fillStyle = getVisualizerColor(colorTheme, i, barsCount, amplitude);
        previewCtx.fillRect(x, y, barWidth, barHeight - 2);
    }
}

// Draw waveform visualizer
function drawWaveform(canvasWidth, canvasHeight, position, size, sensitivity, colorTheme) {
    const positionData = calculateVisualizerPosition(position, canvasWidth, canvasHeight, size);
    
    previewCtx.beginPath();
    previewCtx.lineWidth = 3;
    previewCtx.strokeStyle = getVisualizerColor(colorTheme, 0, 1, 128);

    const sliceWidth = positionData.width / frequencyData.length;
    let x = positionData.x;

    for (let i = 0; i < frequencyData.length; i++) {
        const amplitude = frequencyData[i] * sensitivity;
        const normalizedAmplitude = (amplitude - 128) * size / 256;
        const y = positionData.centerY + normalizedAmplitude;

        if (i === 0) {
            previewCtx.moveTo(x, y);
        } else {
            previewCtx.lineTo(x, y);
        }

        x += sliceWidth;
    }

    previewCtx.stroke();
}

// Draw circular visualizer
function drawCircularVisualizer(canvasWidth, canvasHeight, size, sensitivity, colorTheme, barsCount, position) {
    const positionData = calculateVisualizerPosition(position || 'center-center', canvasWidth, canvasHeight, size);
    const centerX = positionData.centerX || positionData.x + positionData.width / 2;
    const centerY = positionData.centerY || positionData.y + positionData.height / 2;
    const radius = size / 2;
    const dataStep = Math.floor(frequencyData.length / barsCount);

    for (let i = 0; i < barsCount; i++) {
        const dataIndex = i * dataStep;
        const amplitude = frequencyData[dataIndex] * sensitivity;
        const angle = (i / barsCount) * Math.PI * 2;
        
        const innerRadius = radius * 0.6;
        const outerRadius = innerRadius + (amplitude * radius * 0.4) / 256;

        const x1 = centerX + Math.cos(angle) * innerRadius;
        const y1 = centerY + Math.sin(angle) * innerRadius;
        const x2 = centerX + Math.cos(angle) * outerRadius;
        const y2 = centerY + Math.sin(angle) * outerRadius;

        previewCtx.beginPath();
        previewCtx.lineWidth = 4;
        previewCtx.strokeStyle = getVisualizerColor(colorTheme, i, barsCount, amplitude);
        previewCtx.moveTo(x1, y1);
        previewCtx.lineTo(x2, y2);
        previewCtx.stroke();
    }
}

// Calculate visualizer position based on 3x3 grid
function calculateVisualizerPosition(position, canvasWidth, canvasHeight, size) {
    const margin = 20;
    const gridWidth = canvasWidth / 3;
    const gridHeight = canvasHeight / 3;
    
    let x, y, width, height, centerX, centerY, isLeft = false;

    switch (position) {
        case 'top-left':
            // Center in top-left grid segment
            centerX = gridWidth / 2;
            centerY = gridHeight / 2;
            x = centerX - size / 2;
            y = centerY - size / 2;
            width = size;
            height = size;
            break;
        case 'top-center':
            // Center in top-center grid segment
            centerX = gridWidth + gridWidth / 2;
            centerY = gridHeight / 2;
            x = centerX - size / 2;
            y = centerY - size / 2;
            width = size;
            height = size;
            break;
        case 'top-right':
            // Center in top-right grid segment
            centerX = gridWidth * 2 + gridWidth / 2;
            centerY = gridHeight / 2;
            x = centerX - size / 2;
            y = centerY - size / 2;
            width = size;
            height = size;
            break;
        case 'center-left':
            // Center in center-left grid segment
            centerX = gridWidth / 2;
            centerY = gridHeight + gridHeight / 2;
            x = centerX - size / 2;
            y = centerY - size / 2;
            width = size;
            height = size;
            isLeft = true;
            break;
        case 'center-center':
            // Center in center grid segment
            centerX = gridWidth + gridWidth / 2;
            centerY = gridHeight + gridHeight / 2;
            x = centerX - size / 2;
            y = centerY - size / 2;
            width = size;
            height = size;
            break;
        case 'center-right':
            // Center in center-right grid segment
            centerX = gridWidth * 2 + gridWidth / 2;
            centerY = gridHeight + gridHeight / 2;
            x = centerX - size / 2;
            y = centerY - size / 2;
            width = size;
            height = size;
            break;
        case 'bottom-left':
            // Center in bottom-left grid segment
            centerX = gridWidth / 2;
            centerY = gridHeight * 2 + gridHeight / 2;
            x = centerX - size / 2;
            y = centerY - size / 2;
            width = size;
            height = size;
            break;
        case 'bottom-center':
            // Center in bottom-center grid segment
            centerX = gridWidth + gridWidth / 2;
            centerY = gridHeight * 2 + gridHeight / 2;
            x = centerX - size / 2;
            y = centerY - size / 2;
            width = size;
            height = size;
            break;
        case 'bottom-right':
            // Center in bottom-right grid segment
            centerX = gridWidth * 2 + gridWidth / 2;
            centerY = gridHeight * 2 + gridHeight / 2;
            x = centerX - size / 2;
            y = centerY - size / 2;
            width = size;
            height = size;
            break;
        case 'overlay':
        default:
            x = 0;
            y = 0;
            width = canvasWidth;
            height = canvasHeight;
            centerX = canvasWidth / 2;
            centerY = canvasHeight / 2;
            break;
    }

    return { x, y, width, height, centerX, centerY, isLeft };
}

// Get visualizer color based on theme
function getVisualizerColor(theme, index, total, amplitude) {
    switch (theme) {
        case 'gold':
            return '#FFC700';
        case 'neon':
            const ratio = index / total;
            const r = Math.floor(255 * (1 - ratio) + 0 * ratio);
            const g = Math.floor(87 * (1 - ratio) + 230 * ratio);
            const b = Math.floor(178 * (1 - ratio) + 255 * ratio);
            return `rgb(${r}, ${g}, ${b})`;
        case 'rainbow':
            const hue = (index / total) * 360;
            return `hsl(${hue}, 100%, 50%)`;
        case 'white':
            return '#FFFFFF';
        case 'red':
            return '#FF3B3B';
        default:
            return '#FFC700';
    }
}

// Draw spiral visualizer
function drawSpiralVisualizer(canvasWidth, canvasHeight, size, sensitivity, colorTheme, barsCount, position) {
    const positionData = calculateVisualizerPosition(position || 'center-center', canvasWidth, canvasHeight, size);
    const centerX = positionData.centerX;
    const centerY = positionData.centerY;
    const maxRadius = size / 2;
    const dataStep = Math.floor(frequencyData.length / barsCount);
    
    previewCtx.beginPath();
    previewCtx.lineWidth = 3;
    
    for (let i = 0; i < barsCount; i++) {
        const dataIndex = i * dataStep;
        const amplitude = frequencyData[dataIndex] * sensitivity;
        const angle = (i / barsCount) * Math.PI * 4; // Multiple rotations for spiral
        const radius = (i / barsCount) * maxRadius + (amplitude / 256) * 20;
        
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        if (i === 0) {
            previewCtx.moveTo(x, y);
        } else {
            previewCtx.lineTo(x, y);
        }
    }
    
    previewCtx.strokeStyle = getVisualizerColor(colorTheme, 0, 1, 128);
    previewCtx.stroke();
}

// Draw particle visualizer
function drawParticleVisualizer(canvasWidth, canvasHeight, size, sensitivity, colorTheme, position) {
    const positionData = calculateVisualizerPosition(position || 'center-center', canvasWidth, canvasHeight, size);
    const centerX = positionData.centerX;
    const centerY = positionData.centerY;
    const particleCount = 32;
    const dataStep = Math.floor(frequencyData.length / particleCount);
    
    for (let i = 0; i < particleCount; i++) {
        const dataIndex = i * dataStep;
        const amplitude = frequencyData[dataIndex] * sensitivity;
        const angle = (i / particleCount) * Math.PI * 2;
        const distance = (amplitude / 256) * size / 2;
        
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        const particleSize = Math.max(2, amplitude / 32);
        
        previewCtx.beginPath();
        previewCtx.arc(x, y, particleSize, 0, Math.PI * 2);
        previewCtx.fillStyle = getVisualizerColor(colorTheme, i, particleCount, amplitude);
        previewCtx.fill();
    }
}

// Draw pulse ring visualizer
function drawPulseRingVisualizer(canvasWidth, canvasHeight, size, sensitivity, colorTheme, position) {
    const positionData = calculateVisualizerPosition(position || 'center-center', canvasWidth, canvasHeight, size);
    const centerX = positionData.centerX;
    const centerY = positionData.centerY;
    
    // Calculate average amplitude for pulse effect
    let totalAmplitude = 0;
    for (let i = 0; i < frequencyData.length; i++) {
        totalAmplitude += frequencyData[i];
    }
    const avgAmplitude = totalAmplitude / frequencyData.length;
    const pulseRadius = (avgAmplitude / 256) * size / 2 * sensitivity;
    
    // Draw multiple rings with different opacities
    for (let ring = 0; ring < 3; ring++) {
        const radius = pulseRadius * (1 + ring * 0.3);
        const opacity = 1 - (ring * 0.3);
        
        previewCtx.beginPath();
        previewCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        previewCtx.strokeStyle = getVisualizerColor(colorTheme, ring, 3, avgAmplitude);
        previewCtx.globalAlpha *= opacity;
        previewCtx.lineWidth = 4 - ring;
        previewCtx.stroke();
    }
}

// Draw spectrum visualizer (like bars but with gradient fill)
function drawSpectrumVisualizer(canvasWidth, canvasHeight, position, size, sensitivity, colorTheme, barsCount) {
    const positionData = calculateVisualizerPosition(position, canvasWidth, canvasHeight, size);
    const barWidth = positionData.width / barsCount;
    const dataStep = Math.floor(frequencyData.length / barsCount);

    for (let i = 0; i < barsCount; i++) {
        const dataIndex = i * dataStep;
        const amplitude = frequencyData[dataIndex] * sensitivity;
        const barHeight = Math.min(amplitude * size / 256, size);

        const x = positionData.x + (i * barWidth);
        const y = positionData.centerY - (barHeight / 2);

        // Create gradient for each bar
        const gradient = previewCtx.createLinearGradient(x, y + barHeight, x, y);
        const baseColor = getVisualizerColor(colorTheme, i, barsCount, amplitude);
        gradient.addColorStop(0, baseColor);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');

        previewCtx.fillStyle = gradient;
        previewCtx.fillRect(x, y, barWidth - 2, barHeight);
    }
}

// Draw 3D wave visualizer
function draw3DWaveVisualizer(canvasWidth, canvasHeight, position, size, sensitivity, colorTheme) {
    const positionData = calculateVisualizerPosition(position, canvasWidth, canvasHeight, size);
    const wavePoints = 64;
    const dataStep = Math.floor(frequencyData.length / wavePoints);
    
    // Draw multiple wave layers for 3D effect
    for (let layer = 0; layer < 3; layer++) {
        previewCtx.beginPath();
        previewCtx.lineWidth = 3 - layer;
        previewCtx.strokeStyle = getVisualizerColor(colorTheme, layer, 3, 128);
        previewCtx.globalAlpha *= (1 - layer * 0.2);
        
        const yOffset = layer * 5; // Depth offset
        const sliceWidth = positionData.width / wavePoints;
        let x = positionData.x;

        for (let i = 0; i < wavePoints; i++) {
            const dataIndex = i * dataStep;
            const amplitude = frequencyData[dataIndex] * sensitivity;
            const y = positionData.centerY + yOffset + (amplitude - 128) * size / 512;

            if (i === 0) {
                previewCtx.moveTo(x, y);
            } else {
                previewCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        previewCtx.stroke();
    }
}

// Parse SRT/VTT data for preview
function parseSrtForPreview() {
    if (!currentSrtData) return [];

    const rawLyrics = [];
    const lines = currentSrtData.split('\n');
    const isVTT = currentSrtData.includes('WEBVTT');
    
    // First pass: Extract all individual lyric segments
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip VTT header lines
        if (isVTT && (line === 'WEBVTT' || line.startsWith('NOTE') || line.startsWith('Kind:') || line.startsWith('Language:'))) {
            continue;
        }
        
        // Look for timestamp lines (both SRT and VTT format)
        if (line.includes('-->')) {
            const [startTime, endTime] = line.split('-->').map(t => t.trim());
            let text = '';
            
            // Get text from next non-empty line(s)
            for (let j = i + 1; j < lines.length; j++) {
                const nextLine = lines[j].trim();
                if (nextLine === '' || nextLine.includes('-->')) {
                    break;
                }
                if (nextLine && !nextLine.match(/^\d+$/)) { // Skip SRT sequence numbers
                    text += (text ? ' ' : '') + nextLine;
                }
            }
            
            // Clean up the text - remove metadata and format properly
            const cleanText = cleanLyricText(text);
            
            if (cleanText) {
                rawLyrics.push({
                    start: timeToMs(startTime, isVTT),
                    end: timeToMs(endTime, isVTT),
                    text: cleanText,
                    originalText: text // Keep original for debugging
                });
            }
        }
    }
    
    // Second pass: Group lyrics based on display mode
    return groupLyrics(rawLyrics);
}

// Clean lyric text by removing metadata and formatting
function cleanLyricText(text) {
    if (!text || typeof text !== 'string') return '';
    
    // Remove common metadata patterns
    let cleanText = text
        // Remove [Verse 1], [Chorus], [Bridge], etc.
        .replace(/\[(?:Verse|Chorus|Bridge|Intro|Outro|Hook|Pre-Chorus|Refrain)\s*\d*\]/gi, '')
        // Remove [Instrumental], [Music], [Beat], etc.
        .replace(/\[(?:Instrumental|Music|Beat|Solo|Break)\]/gi, '')
        // Remove (Verse 1), (Chorus), etc.
        .replace(/\((?:Verse|Chorus|Bridge|Intro|Outro|Hook|Pre-Chorus|Refrain)\s*\d*\)/gi, '')
        // Remove HTML tags if any
        .replace(/<[^>]*>/g, '')
        // Remove extra whitespace and normalize
        .replace(/\s+/g, ' ')
        .trim();
    
    // Skip lines that are just metadata or empty
    if (!cleanText || 
        cleanText.match(/^(?:Verse|Chorus|Bridge|Intro|Outro|Hook|Pre-Chorus|Refrain)\s*\d*$/i) ||
        cleanText.match(/^(?:Instrumental|Music|Beat|Solo|Break)$/i) ||
        cleanText.length < 2) {
        return '';
    }
    
    return cleanText;
}

// Group lyrics based on display mode
function groupLyrics(rawLyrics) {
    if (!rawLyrics || rawLyrics.length === 0) return [];
    
    const displayMode = document.getElementById('lyric-display-mode')?.value || 'line';
    const maxWords = parseInt(document.getElementById('max-words')?.value) || 8;
    const minDuration = parseInt(document.getElementById('min-duration')?.value) || 2000;
    
    switch (displayMode) {
        case 'word':
            return rawLyrics; // Keep individual words
            
        case 'line':
            return groupByLines(rawLyrics, minDuration);
            
        case 'phrase':
            return groupByPhrases(rawLyrics, maxWords, minDuration);
            
        case 'sentence':
            return groupBySentences(rawLyrics, minDuration);
            
        case 'verse':
            return groupByVerse(rawLyrics);
            
        case 'custom':
            return groupByCustom(rawLyrics, maxWords, minDuration);
            
        default:
            return rawLyrics;
    }
}

// Group by complete lines (merge consecutive words until line break or pause)
function groupByLines(rawLyrics, minDuration) {
    const grouped = [];
    let currentGroup = null;
    
    for (let i = 0; i < rawLyrics.length; i++) {
        const lyric = rawLyrics[i];
        
        if (!currentGroup) {
            currentGroup = {
                start: lyric.start,
                end: lyric.end,
                text: lyric.text,
                words: [lyric]
            };
        } else {
            // Check if this should be part of the same line
            const timeSinceLastWord = lyric.start - currentGroup.end;
            const shouldGroup = timeSinceLastWord < 500; // Less than 500ms gap
            
            if (shouldGroup) {
                // Add to current group
                currentGroup.text += ' ' + lyric.text;
                currentGroup.end = lyric.end;
                currentGroup.words.push(lyric);
            } else {
                // Finish current group and start new one
                if (currentGroup.end - currentGroup.start >= minDuration || currentGroup.words.length >= 3) {
                    grouped.push(currentGroup);
                }
                currentGroup = {
                    start: lyric.start,
                    end: lyric.end,
                    text: lyric.text,
                    words: [lyric]
                };
            }
        }
    }
    
    // Add final group
    if (currentGroup) {
        grouped.push(currentGroup);
    }
    
    return grouped;
}

// Group by smart phrases (natural speech patterns)
function groupByPhrases(rawLyrics, maxWords, minDuration) {
    const grouped = [];
    let currentGroup = null;
    
    for (let i = 0; i < rawLyrics.length; i++) {
        const lyric = rawLyrics[i];
        
        if (!currentGroup) {
            currentGroup = {
                start: lyric.start,
                end: lyric.end,
                text: lyric.text,
                words: [lyric]
            };
        } else {
            const timeSinceLastWord = lyric.start - currentGroup.end;
            const shouldGroup = timeSinceLastWord < 800 && currentGroup.words.length < maxWords;
            
            // Check for natural phrase breaks
            const lastWord = currentGroup.text.toLowerCase();
            const isNaturalBreak = lastWord.match(/[,.!?;:]$/) || 
                                 ['and', 'or', 'but', 'so', 'then', 'now', 'oh', 'yeah'].includes(lastWord);
            
            if (shouldGroup && !isNaturalBreak) {
                currentGroup.text += ' ' + lyric.text;
                currentGroup.end = lyric.end;
                currentGroup.words.push(lyric);
            } else {
                grouped.push(currentGroup);
                currentGroup = {
                    start: lyric.start,
                    end: lyric.end,
                    text: lyric.text,
                    words: [lyric]
                };
            }
        }
    }
    
    if (currentGroup) {
        grouped.push(currentGroup);
    }
    
    return grouped;
}

// Group by complete sentences
function groupBySentences(rawLyrics, minDuration) {
    const grouped = [];
    let currentGroup = null;
    
    for (let i = 0; i < rawLyrics.length; i++) {
        const lyric = rawLyrics[i];
        
        if (!currentGroup) {
            currentGroup = {
                start: lyric.start,
                end: lyric.end,
                text: lyric.text,
                words: [lyric]
            };
        } else {
            currentGroup.text += ' ' + lyric.text;
            currentGroup.end = lyric.end;
            currentGroup.words.push(lyric);
            
            // Check for sentence end
            if (lyric.text.match(/[.!?]$/)) {
                grouped.push(currentGroup);
                currentGroup = null;
            }
        }
    }
    
    if (currentGroup) {
        grouped.push(currentGroup);
    }
    
    return grouped;
}

// Custom grouping based on word count and duration
function groupByCustom(rawLyrics, maxWords, minDuration) {
    const grouped = [];
    let currentGroup = null;
    
    for (let i = 0; i < rawLyrics.length; i++) {
        const lyric = rawLyrics[i];
        
        if (!currentGroup) {
            currentGroup = {
                start: lyric.start,
                end: lyric.end,
                text: lyric.text,
                words: [lyric]
            };
        } else {
            const wouldExceedWords = currentGroup.words.length >= maxWords;
            const wouldExceedDuration = (lyric.end - currentGroup.start) > minDuration * 2;
            const timeSinceLastWord = lyric.start - currentGroup.end;
            
            if (wouldExceedWords || wouldExceedDuration || timeSinceLastWord > 1000) {
                grouped.push(currentGroup);
                currentGroup = {
                    start: lyric.start,
                    end: lyric.end,
                    text: lyric.text,
                    words: [lyric]
                };
            } else {
                currentGroup.text += ' ' + lyric.text;
                currentGroup.end = lyric.end;
                currentGroup.words.push(lyric);
            }
        }
    }
    
    if (currentGroup) {
        grouped.push(currentGroup);
    }
    
    return grouped;
}

// Group by verse blocks (Spotify-style)
function groupByVerse(rawLyrics) {
    const linesPerVerse = parseInt(document.getElementById('lines-per-verse')?.value) || 4;
    
    // First group into lines
    const lines = groupByLines(rawLyrics, 1000); // Use shorter duration for line grouping
    
    // Then group lines into verses
    const verses = [];
    
    for (let i = 0; i < lines.length; i += linesPerVerse) {
        const verseLines = lines.slice(i, i + linesPerVerse);
        
        if (verseLines.length > 0) {
            verses.push({
                start: verseLines[0].start,
                end: verseLines[verseLines.length - 1].end,
                text: verseLines.map(line => line.text).filter(Boolean).join(' '),
                lines: verseLines,
                isVerse: true
            });
        }
    }
    
    return verses;
}

// Convert SRT/VTT time to milliseconds
function timeToMs(timeStr, isVTT = false) {
    // VTT uses dots, SRT uses commas for milliseconds
    const separator = isVTT ? '.' : ',';
    const parts = timeStr.split(separator);
    const time = parts[0];
    const ms = parts[1] || '0';
    
    const [hours, minutes, seconds] = time.split(':').map(Number);
    return (hours * 3600 + minutes * 60 + seconds) * 1000 + parseInt(ms.padEnd(3, '0').substring(0, 3));
}

// Format time for display
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Generate video (placeholder - would need server-side processing)
function generateVideo() {
    if (activeMediaRecorder && activeMediaRecorder.state !== 'inactive') {
        showMusicStatus('⚠️ A video render is already in progress. Please wait for it to finish.', true);
        return;
    }

    const generateBtn = document.getElementById('generate-video');

    try {
        const filenameBase = getDesiredFilenameBase();
        const preparation = preparePreview({
            autoplay: false,
            allowMissingImage: true
        });

        if (!preparation) {
            return;
        }

        const { audioPreview, startTimeSeconds } = preparation;

        if (!previewCanvas || typeof previewCanvas.captureStream !== 'function') {
            showMusicStatus('❌ This browser cannot capture the preview canvas. Try using the latest Chrome or Edge.', true);
            return;
        }

        const canvasStream = previewCanvas.captureStream(60);
        const audioCapture = audioPreview.captureStream?.() || audioPreview.mozCaptureStream?.();

        if (!audioCapture) {
            showMusicStatus('❌ Unable to capture audio from the player. Please use a Chromium-based browser.', true);
            canvasStream.getTracks().forEach(track => track.stop());
            return;
        }

        if (typeof MediaRecorder === 'undefined') {
            showMusicStatus('❌ MediaRecorder is not supported in this browser.', true);
            canvasStream.getTracks().forEach(track => track.stop());
            audioCapture.getTracks().forEach(track => track.stop());
            return;
        }

        let mimeType = '';
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
            mimeType = 'video/webm;codecs=vp9,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
            mimeType = 'video/webm;codecs=vp8,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
            mimeType = 'video/webm;codecs=vp8';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
            mimeType = 'video/webm';
        }

        if (!mimeType) {
            showMusicStatus('❌ This browser does not support WebM recording. Try Chrome or Edge.', true);
            canvasStream.getTracks().forEach(track => track.stop());
            audioCapture.getTracks().forEach(track => track.stop());
            return;
        }

        const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...audioCapture.getAudioTracks()
        ]);

        let recorder;
        try {
            recorder = new MediaRecorder(combinedStream, {
                mimeType,
                videoBitsPerSecond: 8_000_000,
                audioBitsPerSecond: 192_000
            });
        } catch (error) {
            showMusicStatus(`❌ Failed to start recorder: ${error.message}`, true);
            canvasStream.getTracks().forEach(track => track.stop());
            audioCapture.getTracks().forEach(track => track.stop());
            return;
        }

        const recordedChunks = [];

        const cleanupStreams = () => {
            canvasStream.getTracks().forEach(track => track.stop());
            audioCapture.getTracks().forEach(track => track.stop());
        };

        const resetGenerateButton = () => {
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.textContent = '🎬 GENERATE VIDEO';
            }
        };

        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.textContent = '🎥 RENDERING...';
        }

        recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        recorder.onstop = async () => {
            cleanupStreams();
            activeMediaRecorder = null;
            activeRecordingCleanup = null;
            resetGenerateButton();

            const blob = new Blob(recordedChunks, { type: mimeType });
            if (!blob.size) {
                showMusicStatus('❌ Recording failed. No data captured.', true);
                return;
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fallbackUrl = URL.createObjectURL(blob);
            const fallbackName = `${filenameBase || 'music-video'}-${timestamp}.webm`;

            const mp4Result = await convertRecordingToMp4(blob, mimeType, filenameBase);

            if (mp4Result && mp4Result.url) {
                const mp4Name = mp4Result.filename || `${filenameBase}.mp4`;
                triggerFileDownload(mp4Result.url, mp4Name);
                showMusicStatus(`✅ Video ready: ${mp4Name}`);
                URL.revokeObjectURL(fallbackUrl);
            } else {
                triggerFileDownload(fallbackUrl, fallbackName);
                showMusicStatus(`✅ Video ready (WebM fallback): ${fallbackName}`);
                setTimeout(() => URL.revokeObjectURL(fallbackUrl), 0);
            }
        };

        recorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error || event);
            cleanupStreams();
            activeMediaRecorder = null;
            activeRecordingCleanup = null;
            resetGenerateButton();
            showMusicStatus(`❌ Recording error: ${event.error?.message || event.message || 'Unknown error'}`, true);
        };

        const handleAudioEnded = () => {
            if (recorder.state !== 'inactive') {
                recorder.stop();
            }
            audioPreview.removeEventListener('ended', handleAudioEnded);
        };

        audioPreview.addEventListener('ended', handleAudioEnded, { once: true });

        activeMediaRecorder = recorder;
        activeRecordingCleanup = () => {
            audioPreview.removeEventListener('ended', handleAudioEnded);
            if (recorder.state !== 'inactive') {
                recorder.stop();
            }
        };

        showMusicStatus(`🎥 Rendering ${filenameBase}.mp4... This will take the full audio duration.`);

        recorder.start(1000);

        if (audioContext && typeof audioContext.resume === 'function') {
            audioContext.resume().catch(() => {});
        }

        audioPreview.currentTime = startTimeSeconds;

        const playPromise = audioPreview.play();
        if (playPromise && typeof playPromise.then === 'function') {
            playPromise.catch(error => {
                showMusicStatus(`⚠️ Press play to start recording: ${error.message}`, true);
            });
        }
    } catch (error) {
        console.error('Error generating music video:', error);
        showMusicStatus(`❌ Failed to generate video: ${error.message}`, true);
        if (activeRecordingCleanup) {
            activeRecordingCleanup();
        }
        activeMediaRecorder = null;
        activeRecordingCleanup = null;
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.textContent = '🎬 GENERATE VIDEO';
        }
    }
}

// Store SRT data when downloaded
const originalDownloadLyrics = downloadLyrics;
downloadLyrics = function(format) {
    originalDownloadLyrics(format).then(() => {
        if (format === 'srt') {
            // Store the SRT data for video creation
            const sunoUrl = document.getElementById('suno-url').value.trim();
            const sessionToken = document.getElementById('session-token').value.trim();
            const songId = extractSongId(sunoUrl);
            
            if (songId && sessionToken) {
                fetchAlignedWords(songId, sessionToken).then(alignedWords => {
                    if (alignedWords) {
                        currentSrtData = convertToSRT(alignedWords);
                        showMusicStatus('✅ SRT data ready for video creation!');
                    }
                }).catch(err => {
                    console.error('Error storing SRT data:', err);
                });
            }
        }
    });
};
