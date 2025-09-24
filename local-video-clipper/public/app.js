// Local Video Clipper App
console.log('🔥🔥🔥 APP.JS VERSION 5 EMERGENCY FIX LOADING 🔥🔥🔥');

class VideoClipper {
    constructor() {
        this.selectedVideo = null;
        this.selectedTranscript = null;
        this.transcriptSegments = [];
        this.selectedSegment = null;
        this.isGenerating = false;
        this.allVideos = [];
        this.currentSort = 'name-asc';
        this.currentSearch = '';
        this.sponsors = this.loadSponsors();
        this.dailyStats = this.loadDailyStats();

        console.log('🔥 VideoClipper constructor - calling init()');
        this.init().catch(error => {
            console.error('❌ VideoClipper init failed:', error);
        });
        
        // INITIALIZE VIRAL FEATURES IMMEDIATELY
        console.log('🔥 INITIALIZING VIRAL CONTENT MACHINE...');
        this.initializeViralFeatures();
    }
    
    initializeViralFeatures() {
        // Make this instance globally available
        window.videoClipper = this;
        
        // Wait a moment then force viral UI creation
        setTimeout(() => {
            console.log('🔥 Creating Viral UI...');
            if (typeof ViralEngine !== 'undefined' && typeof ViralUI !== 'undefined') {
                window.viralEngine = new ViralEngine();
                window.viralUI = new ViralUI(this);
                console.log('✅ VIRAL CONTENT MACHINE ACTIVATED!');
                
                // Add visual confirmation
                this.showStatus('🔥 VIRAL CONTENT MACHINE ACTIVATED! Click videos to see viral moments! 🚀');
            } else {
                console.error('❌ Viral classes not loaded');
                this.showStatus('❌ Viral features failed to load - check console', true);
            }
        }, 1000);
    }

    async init() {
        await this.loadVideos();
        await this.loadTranscripts();
        await this.loadClips();
        this.setupEventListeners();
        
        // Initialize sponsor system
        this.updateSponsorSelect();
        this.updateRevenueDisplay();
    }

    async loadVideos() {
        try {
            const response = await fetch('/api/videos');
            this.allVideos = await response.json();
            
            // Load video-transcript mapping
            const mappingResponse = await fetch('/api/video-transcript-mapping');
            this.videoTranscriptMapping = await mappingResponse.json();
            
            console.log(`📹 Loaded ${this.allVideos.length} videos`);
            console.log(`📋 Found ${this.videoTranscriptMapping.withTranscripts} videos with transcripts`);
            
            this.renderVideos();
        } catch (error) {
            console.error('Error loading videos:', error);
            document.getElementById('video-list').innerHTML = 
                '<div class="text-center py-4 text-red-400 font-mono">VIDEO SCAN FAILED</div>';
        }
    }

    renderVideos() {
        const videoList = document.getElementById('video-list');
        
        if (this.allVideos.length === 0) {
            videoList.innerHTML = '<div class="text-center py-4 text-light-gray">No video files found</div>';
            return;
        }

        // Filter videos based on search
        let filteredVideos = this.allVideos;
        if (this.currentSearch) {
            filteredVideos = this.allVideos.filter(video => 
                video.title.toLowerCase().includes(this.currentSearch.toLowerCase()) ||
                video.filename.toLowerCase().includes(this.currentSearch.toLowerCase())
            );
        }

        // Sort videos
        filteredVideos = this.sortVideos(filteredVideos, this.currentSort);

        if (filteredVideos.length === 0) {
            videoList.innerHTML = '<div class="text-center py-4 text-light-gray">No videos match your search</div>';
            return;
        }

        videoList.innerHTML = filteredVideos.map(video => {
            // Find if this video has a transcript
            const mapping = this.videoTranscriptMapping?.mapping?.find(m => m.video.filename === video.filename);
            const hasTranscript = mapping?.hasTranscript || false;
            const confidence = mapping?.confidence || 'none';
            
            return `
                <div class="video-item p-3 bg-primary-black rounded cursor-pointer hover:bg-dark-gray transition-colors border border-primary-red/30 hover:border-primary-gold ${hasTranscript ? 'border-l-4 border-l-matrix-green' : 'border-l-4 border-l-safe-muted'}" 
                     data-video='${JSON.stringify(video)}' data-mapping='${JSON.stringify(mapping || {})}' data-filename="${video.filename}">
                    <div class="flex justify-between items-start mb-1">
                        <div class="font-mono text-primary-gold text-sm font-bold line-clamp-2">${video.title}</div>
                        ${hasTranscript ? '<div class="text-xs text-matrix-green">📋 TRANSCRIPT</div>' : '<div class="text-xs text-safe-muted">📋 NO TRANSCRIPT</div>'}
                    </div>
                    <div class="text-xs text-safe-muted mt-1 font-mono">${video.filename}</div>
                    <div class="flex justify-between items-center mt-2 text-xs text-safe-muted">
                        <span>${this.formatFileSize(video.size)}</span>
                        <span>${this.formatDate(video.modified)}</span>
                    </div>
                    ${hasTranscript ? `<div class="text-xs text-matrix-green mt-1 font-mono">📋 ${mapping.transcript.title}</div>` : ''}
                </div>
            `;
        }).join('');

        // Add click handlers
        document.querySelectorAll('.video-item').forEach(item => {
            item.addEventListener('click', () => {
                console.log('🔥 EMERGENCY: Video item clicked!');
                const video = JSON.parse(item.dataset.video);
                const mapping = JSON.parse(item.dataset.mapping || '{}');
                console.log('🔥 EMERGENCY: Parsed video:', video.filename);
                console.log('🔥 EMERGENCY: Parsed mapping hasTranscript:', mapping.hasTranscript);
                console.log('🔥 EMERGENCY: Parsed mapping transcript:', mapping.transcript?.filename);
                
                // FORCE CALL selectVideo
                console.log('🔥 EMERGENCY: FORCING selectVideo call...');
                this.selectVideo(video, mapping);
                
                // EMERGENCY: If has transcript, FORCE load it
                if (mapping.hasTranscript && mapping.transcript?.filename) {
                    console.log('🔥 EMERGENCY: FORCING loadTranscript call...');
                    setTimeout(() => {
                        this.loadTranscript(mapping.transcript.filename);
                    }, 100);
                }
            });
        });
    }

    sortVideos(videos, sortType) {
        const sorted = [...videos];
        
        switch (sortType) {
            case 'name-asc':
                return sorted.sort((a, b) => a.title.localeCompare(b.title));
            case 'name-desc':
                return sorted.sort((a, b) => b.title.localeCompare(a.title));
            case 'date-desc':
                return sorted.sort((a, b) => new Date(b.modified) - new Date(a.modified));
            case 'date-asc':
                return sorted.sort((a, b) => new Date(a.modified) - new Date(b.modified));
            case 'size-desc':
                return sorted.sort((a, b) => b.size - a.size);
            case 'size-asc':
                return sorted.sort((a, b) => a.size - b.size);
            default:
                return sorted;
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Today';
        if (diffDays === 2) return 'Yesterday';
        if (diffDays <= 7) return `${diffDays} days ago`;
        if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
        if (diffDays <= 365) return `${Math.ceil(diffDays / 30)} months ago`;
        
        return date.toLocaleDateString();
    }

    async loadTranscripts() {
        try {
            const response = await fetch('/api/transcripts');
            const transcripts = await response.json();
            
            const transcriptList = document.getElementById('transcript-list');
            if (transcripts.length === 0) {
                transcriptList.innerHTML = '<div class="text-center py-4 text-light-gray">No transcript files found</div>';
                return;
            }

            transcriptList.innerHTML = transcripts.map(transcript => `
                <div class="transcript-item p-3 bg-dark-gray rounded cursor-pointer hover:bg-border transition-colors" 
                     data-transcript='${JSON.stringify(transcript)}'>
                    <div class="font-medium text-sand text-sm">${transcript.title}</div>
                    <div class="text-xs text-light-gray mt-1">${transcript.filename}</div>
                </div>
            `).join('');

            document.querySelectorAll('.transcript-item').forEach(item => {
                item.addEventListener('click', () => {
                    const transcript = JSON.parse(item.dataset.transcript);
                    this.selectTranscript(transcript);
                });
            });
        } catch (error) {
            console.error('Error loading transcripts:', error);
            document.getElementById('transcript-list').innerHTML = 
                '<div class="text-center py-4 text-red-400">Error loading transcripts</div>';
        }
    }

    selectVideo(video, mapping = {}) {
        console.log('🔥 selectVideo called with:', {video: video.filename, mapping: mapping});
        this.selectedVideo = video;
        
        document.querySelectorAll('.video-item').forEach(item => {
            item.classList.remove('border-2', 'border-gold', 'bg-gold');
            item.classList.add('bg-dark-gray');
        });
        
        const selectedElement = document.querySelector(`[data-filename="${video.filename}"]`);
        if (selectedElement) {
            selectedElement.classList.add('border-2', 'border-gold', 'bg-gold');
        }

        const videoPlayer = document.getElementById('video-player');
        videoPlayer.innerHTML = `
            <video controls class="w-full rounded-lg">
                <source src="${video.path}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        `;

        // EMERGENCY: ALWAYS try to load transcript
        console.log('🔥 EMERGENCY: selectVideo mapping check:', mapping);
        if (mapping.hasTranscript && mapping.transcript?.filename) {
            console.log(`🔥 EMERGENCY: FORCING transcript load: ${mapping.transcript.filename}`);
            // FORCE the transcript load immediately
            this.loadTranscript(mapping.transcript.filename).catch(error => {
                console.error('🔥 EMERGENCY: loadTranscript failed:', error);
            });
        } else {
            console.log('🔥 EMERGENCY: No transcript mapping found:', mapping);
            // Clear transcript content if no transcript  
            const transcriptContent = document.getElementById('transcript-list-content');
            if (transcriptContent) {
                transcriptContent.innerHTML = '<div class="text-center py-8 text-light-gray">Select a transcript to view segments</div>';
            }
            this.transcriptSegments = [];
        }

        this.checkGenerateButton();
    }

    async loadTranscript(filename) {
        try {
            console.log(`🔥 Loading transcript: ${filename}`);
            const response = await fetch(`/api/transcripts/${encodeURIComponent(filename)}`);
            console.log(`🔥 Response status: ${response.status}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load transcript: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`🔥 Raw data segments count:`, data.segments ? data.segments.length : 'NO SEGMENTS');
            this.transcriptSegments = data.segments || [];
            
            console.log(`🔥 Loaded ${this.transcriptSegments.length} transcript segments`);
            
            // Render transcript content in CENTER panel
            const transcriptContent = document.getElementById('transcript-list-content');
            console.log(`🔥 Found transcript-list-content element:`, !!transcriptContent);
            
            if (this.transcriptSegments.length === 0) {
                transcriptContent.innerHTML = '<div class="text-center py-8 text-light-gray">No transcript segments found</div>';
                return;
            }
            
            console.log(`🔥 Rendering ${this.transcriptSegments.length} segments...`);
            
            // Show first 100 segments for performance, add "Load More" button
            const segmentsToShow = this.transcriptSegments.slice(0, 100);
            
            transcriptContent.innerHTML = `
                <div class="mb-4 text-center">
                    <div class="text-sm text-gold font-bold">📋 ${data.title || filename}</div>
                    <div class="text-xs text-light-gray">${this.transcriptSegments.length} segments • ${Math.round(data.estimatedDuration / 1000 / 60)} minutes</div>
                </div>
                ${segmentsToShow.map((segment, index) => {
                    const controversyScore = Math.random() * 100; // Simulate AI controversy scoring
                    return `
                    <div class="transcript-segment terminal-text p-3 bg-primary-black/80 rounded cursor-pointer hover:bg-primary-red/20 transition-colors mb-2 border border-matrix-green/30" 
                         data-segment-index="${index}"
                         data-start="${segment.start}"
                         data-end="${segment.end}">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-xs military-time">${this.formatTime(segment.start / 1000)}</span>
                            <div class="flex items-center gap-2">
                                ${this.generateHeatMeter(controversyScore)}
                                <span class="text-xs text-matrix-green">${((segment.end - segment.start) / 1000).toFixed(1)}s</span>
                            </div>
                        </div>
                        <p class="text-sm text-matrix-green leading-relaxed font-mono">${segment.text}</p>
                        <div class="text-xs text-danger-glow mt-1">
                            <span class="danger-level">SPICE: ${Math.round(controversyScore)}%</span>
                        </div>
                    </div>
                `}).join('')}
                ${this.transcriptSegments.length > 100 ? 
                    `<div class="text-center py-4">
                        <button id="load-more-segments" class="px-4 py-2 bg-gold text-charcoal rounded font-bold hover:bg-amber transition-colors">
                            Load More Segments (${this.transcriptSegments.length - 100} remaining)
                        </button>
                    </div>` : ''
                }
            `;
            
            console.log(`🔥 Transcript HTML rendered successfully`);
            
            // Add click handlers to transcript segments
            document.querySelectorAll('.transcript-segment').forEach(segmentEl => {
                segmentEl.addEventListener('click', () => {
                    const index = parseInt(segmentEl.dataset.segmentIndex);
                    const segment = this.transcriptSegments[index];
                    
                    // Select this segment
                    this.selectedSegment = {
                        start: segment.start / 1000, // Convert to seconds
                        end: segment.end / 1000,     // Convert to seconds
                        text: segment.text,
                        timestamp: segment.start / 1000,
                        timeString: this.formatTime(segment.start / 1000)
                    };
                    
                    // Visual feedback
                    document.querySelectorAll('.transcript-segment').forEach(el => {
                        el.classList.remove('border-2', 'border-gold');
                    });
                    segmentEl.classList.add('border-2', 'border-gold');
                    
                    console.log(`📋 Selected transcript segment: ${this.selectedSegment.timeString} - ${segment.text.substring(0, 50)}...`);
                    this.checkGenerateButton();
                });
            });
            
        } catch (error) {
            console.error('❌ Error loading transcript:', error);
            const transcriptContent = document.getElementById('transcript-list-content');
            if (transcriptContent) {
                transcriptContent.innerHTML = 
                    `<div class="text-center py-8 text-red-400">Error loading transcript: ${error.message}</div>`;
            }
        }
    }

    async selectTranscript(transcript) {
        this.selectedTranscript = transcript;
        
        document.querySelectorAll('.transcript-item').forEach(item => {
            item.classList.remove('border-2', 'border-gold', 'bg-gold');
            item.classList.add('bg-dark-gray');
        });
        
        document.querySelector(`[data-transcript='${JSON.stringify(transcript)}']`)
            .classList.add('border-2', 'border-gold', 'bg-gold');

        try {
            const response = await fetch(`/api/transcript/${transcript.filename}`);
            this.transcriptSegments = await response.json();
            this.renderTranscript();
        } catch (error) {
            console.error('Error loading transcript content:', error);
            document.getElementById('transcript-content').innerHTML = 
                '<div class="text-center py-4 text-red-400">Error loading transcript</div>';
        }

        this.checkGenerateButton();
    }

    renderTranscript() {
        const transcriptContent = document.getElementById('transcript-content');
        const searchTerm = document.getElementById('search-transcript').value.toLowerCase();
        
        let filteredSegments = this.transcriptSegments;
        if (searchTerm) {
            filteredSegments = this.transcriptSegments.filter(segment =>
                segment.text.toLowerCase().includes(searchTerm)
            );
        }

        transcriptContent.innerHTML = filteredSegments.map((segment, index) => `
            <div class="transcript-segment p-3 bg-dark-gray rounded cursor-pointer hover:bg-border transition-colors"
                 data-segment='${JSON.stringify(segment)}'>
                <div class="flex items-start space-x-3">
                    <div class="text-gold text-sm font-mono min-w-[60px]">
                        ${this.formatTime(segment.start)}
                    </div>
                    <div class="text-light-gray text-sm flex-1">
                        ${searchTerm ? this.highlightText(segment.text, searchTerm) : segment.text}
                    </div>
                    <button class="text-gold hover:text-amber text-sm" onclick="clipper.selectSegment(${index})">
                        ✂️
                    </button>
                </div>
            </div>
        `).join('');
    }

    selectSegment(index) {
        const segment = this.transcriptSegments[index];
        this.selectedSegment = segment;

        const selectedSegmentDiv = document.getElementById('selected-segment');
        const segmentInfo = document.getElementById('segment-info');
        const segmentText = document.getElementById('segment-text');

        selectedSegmentDiv.classList.remove('hidden');
        segmentInfo.textContent = `${this.formatTime(segment.start)} - ${this.formatTime(segment.end)} (${(segment.end - segment.start).toFixed(1)}s)`;
        segmentText.textContent = segment.text;

        document.querySelectorAll('.transcript-segment').forEach(item => {
            item.classList.remove('border-l-4', 'border-gold');
        });
        
        document.querySelectorAll('.transcript-segment')[index]
            .classList.add('border-l-4', 'border-gold');

        this.checkGenerateButton();
    }

    checkGenerateButton() {
        const generateBtn = document.getElementById('generate-clip');
        // Can generate if we have a video and either a transcript segment OR manual timestamps work
        const canGenerate = this.selectedVideo && this.selectedSegment && !this.isGenerating;
        
        generateBtn.disabled = !canGenerate;
        generateBtn.textContent = this.isGenerating ? 'Generating...' : 'Generate Clip';
    }

    // OLD BROKEN FUNCTION REMOVED

    async createManualClipDirect() {
        if (!this.selectedVideo) {
            this.showStatus('Please select a video first', true);
            return;
        }

        // DEBUG: Log all input elements on the page
        console.log('🔥 ALL INPUT ELEMENTS:');
        const allInputs = document.querySelectorAll('input');
        allInputs.forEach((input, i) => {
            console.log(`  Input ${i}: id="${input.id}", value="${input.value}", placeholder="${input.placeholder}"`);
        });

        // Try every possible way to get the values
        let startTime = '';
        let endTime = '';
        let title = '';

        // Method 1: Direct ID
        const startEl = document.getElementById('manual-start');
        const endEl = document.getElementById('manual-end');
        const titleEl = document.getElementById('manual-title');

        console.log('🔥 DIRECT ELEMENT LOOKUP:');
        console.log('  startEl:', startEl, 'value:', startEl?.value);
        console.log('  endEl:', endEl, 'value:', endEl?.value);
        console.log('  titleEl:', titleEl, 'value:', titleEl?.value);

        if (startEl?.value) startTime = startEl.value.trim();
        if (endEl?.value) endTime = endEl.value.trim();
        if (titleEl?.value) title = titleEl.value.trim();

        // If still empty, try scanning all inputs for time-like values
        if (!startTime || !endTime) {
            console.log('🔥 SCANNING ALL INPUTS FOR TIME VALUES:');
            allInputs.forEach((input, i) => {
                const val = input.value.trim();
                console.log(`  Input ${i} value: "${val}"`);
                if (val && (val.includes(':') || val.includes('['))) {
                    if (!startTime) {
                        startTime = val;
                        console.log(`  → Used as startTime: "${val}"`);
                    } else if (!endTime && val !== startTime) {
                        endTime = val;
                        console.log(`  → Used as endTime: "${val}"`);
                    }
                }
            });
        }

        console.log('🔥 FINAL VALUES:');
        console.log('  startTime:', `"${startTime}"`);
        console.log('  endTime:', `"${endTime}"`);
        console.log('  title:', `"${title}"`);

        if (!startTime || !endTime) {
            this.showStatus(`Missing values! Start: "${startTime}", End: "${endTime}"`, true);
            return;
        }

        this.processManualClip(startTime, endTime, title);
    }

    async processManualClip(startTime, endTime, title) {
        console.log('🔥 PROCESSING MANUAL CLIP:');
        console.log('  startTime:', startTime);
        console.log('  endTime:', endTime);
        console.log('  title:', title);

        try {
            const startSeconds = this.parseTimeToSeconds(startTime);
            const endSeconds = this.parseTimeToSeconds(endTime);
            
            console.log('🔥 PARSED TIMES:');
            console.log('  startSeconds:', startSeconds);
            console.log('  endSeconds:', endSeconds);

            if (startSeconds >= endSeconds) {
                this.showStatus('End time must be after start time', true);
                return;
            }

            // No length limit - create clips as long as you want!

            // Create a manual segment
            const manualSegment = {
                start: startSeconds,
                end: endSeconds,
                text: title || `Manual clip: ${startTime} - ${endTime}`,
                timestamp: startSeconds,
                timeString: startTime
            };

            this.selectedSegment = manualSegment;
            this.generateClip();

            // Clear the form
            document.getElementById('manual-start').value = '';
            document.getElementById('manual-end').value = '';
            document.getElementById('manual-title').value = '';

        } catch (error) {
            this.showStatus('Invalid time format. Use MM:SS, HH:MM:SS, or [HH:MM:SS.mmm]', true);
        }
    }

    parseTimeToSeconds(timeString) {
        // Handle formats like "1:23", "1:23:45", "0:44", "23:45", "[00:38:24.877]"
        // Remove brackets if present: [00:38:24.877] -> 00:38:24.877
        const cleanTime = timeString.replace(/[\[\]]/g, '').trim();
        
        const parts = cleanTime.split(':');
        
        if (parts.length === 2) {
            // MM:SS or MM:SS.mmm format
            const minutes = parseInt(parts[0]);
            const secondsFloat = parseFloat(parts[1]);
            if (minutes < 0 || secondsFloat < 0 || secondsFloat >= 60) {
                throw new Error('Invalid time format');
            }
            return minutes * 60 + secondsFloat;
        } else if (parts.length === 3) {
            // HH:MM:SS or HH:MM:SS.mmm format
            const hours = parseInt(parts[0]);
            const minutes = parseInt(parts[1]);
            const secondsFloat = parseFloat(parts[2]);
            if (hours < 0 || minutes < 0 || secondsFloat < 0 || minutes >= 60 || secondsFloat >= 60) {
                throw new Error('Invalid time format');
            }
            return hours * 3600 + minutes * 60 + secondsFloat;
        } else {
            throw new Error('Invalid time format');
        }
    }

    toggleBatchMode() {
        const batchMode = document.getElementById('batch-mode');
        const toggleBtn = document.getElementById('toggle-batch-mode');
        
        if (batchMode.classList.contains('hidden')) {
            batchMode.classList.remove('hidden');
            toggleBtn.textContent = 'Single Mode';
            toggleBtn.classList.add('bg-gold', 'text-charcoal');
            toggleBtn.classList.remove('bg-surface', 'text-sand');
        } else {
            batchMode.classList.add('hidden');
            toggleBtn.textContent = 'Batch Mode';
            toggleBtn.classList.remove('bg-gold', 'text-charcoal');
            toggleBtn.classList.add('bg-surface', 'text-sand');
        }
    }

    async createBatchClips() {
        if (!this.selectedVideo) {
            this.showStatus('Please select a video first', true);
            return;
        }

        const batchInput = document.getElementById('batch-input').value.trim();
        if (!batchInput) {
            this.showStatus('Please enter clip timestamps', true);
            return;
        }

        const lines = batchInput.split('\n').filter(line => line.trim());
        const clips = [];

        // Parse all clips first
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            try {
                const clip = this.parseBatchLine(line, i + 1);
                clips.push(clip);
            } catch (error) {
                this.showStatus(`Error on line ${i + 1}: ${error.message}`, true);
                return;
            }
        }

        // Generate all clips
        this.showStatus(`Starting batch generation of ${clips.length} clips...`);
        let successCount = 0;

        for (let i = 0; i < clips.length; i++) {
            try {
                this.showStatus(`Generating clip ${i + 1} of ${clips.length}: ${clips[i].title}`);
                this.selectedSegment = clips[i];
                await this.generateClip();
                successCount++;
                
                // Small delay between clips
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Error generating clip ${i + 1}:`, error);
                this.showStatus(`Error on clip ${i + 1}: ${error.message}`, true);
            }
        }

        this.showStatus(`Batch complete! Generated ${successCount} of ${clips.length} clips`);
        
        // Clear batch input
        document.getElementById('batch-input').value = '';
    }

    parseBatchLine(line, lineNumber) {
        // Expected format: "0:44-0:53 Title Here" or "1:08-1:47 Another Title"
        const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)-(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
        
        if (!match) {
            throw new Error('Invalid format. Use: start-end title (e.g., "0:44-0:53 Clip Title")');
        }

        const [, startTime, endTime, title] = match;
        
        const startSeconds = this.parseTimeToSeconds(startTime);
        const endSeconds = this.parseTimeToSeconds(endTime);

        if (startSeconds >= endSeconds) {
            throw new Error('End time must be after start time');
        }

        // No length limit - make clips as long as needed!

        return {
            start: startSeconds,
            end: endSeconds,
            text: title,
            title: title,
            timestamp: startSeconds,
            timeString: startTime
        };
    }

    async generateClip() {
        if (!this.selectedVideo || !this.selectedSegment || this.isGenerating) return;

        this.isGenerating = true;
        this.checkGenerateButton();
        this.showStatus('Generating clip...', false);

        try {
            // Get sponsor logo data
            const currentSponsor = this.getCurrentSponsor();
            let logoData = null;
            let sponsorRate = 0;
            
            if (document.getElementById('logo-enabled').checked && currentSponsor) {
                logoData = currentSponsor.logoData;
                sponsorRate = currentSponsor.rate;
            }

            const config = {
                format: document.getElementById('clip-format').value,
                quality: document.getElementById('clip-quality').value,
                banner: {
                    enabled: document.getElementById('banner-enabled').checked,
                    text: document.getElementById('banner-text').value,
                    speed: parseInt(document.getElementById('banner-speed').value),
                    position: 'bottom'
                },
                logo: {
                    enabled: document.getElementById('logo-enabled').checked && logoData !== null,
                    data: logoData,
                    position: document.getElementById('logo-position').value,
                    size: document.getElementById('logo-size').value,
                    opacity: parseInt(document.getElementById('logo-opacity').value) / 100
                }
            };

            // Check if viral mode is active
            const viralMode = document.querySelector('.viral-machine') && !document.getElementById('viral-content').classList.contains('hidden');
            
            const response = await fetch('/api/generate-clip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoFile: this.selectedVideo.filename,
                    segment: this.selectedSegment,
                    config,
                    viralMode: viralMode,
                    platform: 'default',
                    controversyScore: this.selectedSegment.controversyScore || 50,
                    hooks: this.selectedSegment.hooks || []
                })
            });

            const result = await response.json();

            if (result.success) {
                // Track revenue for this clip
                this.trackClipGeneration(sponsorRate);
                
                const revenueMessage = sponsorRate > 0 ? ` 💰 Revenue: $${sponsorRate}` : '';
                this.showStatus(`Clip generated successfully!${revenueMessage}`);
                await this.loadClips();
                
                this.selectedSegment = null;
                document.getElementById('selected-segment').classList.add('hidden');
                document.querySelectorAll('.transcript-segment').forEach(item => {
                    item.classList.remove('border-l-4', 'border-gold');
                });
            } else {
                throw new Error(result.error || 'Failed to generate clip');
            }
        } catch (error) {
            console.error('Error generating clip:', error);
            this.showStatus(`Error: ${error.message}`, true);
        } finally {
            this.isGenerating = false;
            this.checkGenerateButton();
        }
    }

    async loadClips() {
        try {
            const response = await fetch('/api/clips');
            const clips = await response.json();
            
            const clipsList = document.getElementById('clips-list');
            if (clips.length === 0) {
                clipsList.innerHTML = '<div class="text-center py-4 text-light-gray">No clips generated yet</div>';
                return;
            }

            clipsList.innerHTML = clips.map(clip => `
                <div class="clip-preview bg-dark-gray rounded-lg p-3 transition-all">
                    <div class="flex items-center justify-between mb-2">
                        <div class="font-medium text-sand text-sm">${clip.id}</div>
                        <div class="text-xs text-light-gray">${this.formatFileSize(clip.size)}</div>
                    </div>
                    <div class="text-xs text-light-gray mb-3">
                        ${new Date(clip.created).toLocaleString()}
                    </div>
                    <div class="flex space-x-2">
                        <a href="${clip.url}" 
                           class="flex-1 text-center py-2 bg-danger-glow text-primary-black text-sm font-bold rounded hover:bg-primary-red transition-colors font-mono tracking-wider"
                           download>
                            📡 EXFILTRATE
                        </a>
                        <button onclick="window.open('${clip.url}', '_blank')"
                                class="px-3 py-2 bg-surface text-sand text-sm rounded hover:bg-border transition-colors">
                            👁️
                        </button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading clips:', error);
        }
    }

    setupEventListeners() {
        document.getElementById('search-transcript').addEventListener('input', () => {
            this.renderTranscript();
        });

        const speedSlider = document.getElementById('banner-speed');
        const speedValue = document.getElementById('speed-value');
        speedSlider.addEventListener('input', () => {
            speedValue.textContent = speedSlider.value;
        });

        document.getElementById('generate-clip').addEventListener('click', () => {
            this.generateClip();
        });

        // OLD EVENT LISTENER REMOVED - USING ONCLICK INSTEAD

        document.getElementById('toggle-batch-mode').addEventListener('click', () => {
            this.toggleBatchMode();
        });

        document.getElementById('create-batch-clips').addEventListener('click', () => {
            this.createBatchClips();
        });

        // Sponsor management event listeners
        document.getElementById('sponsor-select').addEventListener('change', () => {
            this.updateSponsorPreview();
        });

        document.getElementById('add-sponsor').addEventListener('click', async () => {
            const name = document.getElementById('sponsor-name').value.trim();
            const rate = document.getElementById('sponsor-rate').value;
            const logoFile = document.getElementById('sponsor-logo-file').files[0];

            if (!name || !logoFile) {
                this.showStatus('Please enter sponsor name and upload logo', true);
                return;
            }

            try {
                const logoData = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(logoFile);
                });

                this.addSponsor(name, logoData, rate);
                
                // Clear form
                document.getElementById('sponsor-name').value = '';
                document.getElementById('sponsor-rate').value = '';
                document.getElementById('sponsor-logo-file').value = '';
                
                this.showStatus(`💰 Added sponsor: ${name} ($${rate}/clip)`);
            } catch (error) {
                this.showStatus('Error adding sponsor', true);
            }
        });

        // Video sorting and searching
        document.getElementById('video-sort').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.renderVideos();
        });

        document.getElementById('video-search').addEventListener('input', (e) => {
            this.currentSearch = e.target.value;
            this.renderVideos();
        });
    }

    showStatus(message, isError = false) {
        const statusBar = document.getElementById('status-bar');
        const statusText = document.getElementById('status-text');

        statusText.textContent = message;
        statusText.className = `text-sm ${isError ? 'text-red-400' : 'text-light-gray'}`;
        
        statusBar.classList.remove('hidden');

        setTimeout(() => {
            statusBar.classList.add('hidden');
        }, 5000);
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        
        // Military time format with milliseconds
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    
    generateHeatMeter(controversyScore = Math.random() * 100) {
        const level = Math.ceil(controversyScore / 20);
        let bars = '';
        for (let i = 1; i <= 5; i++) {
            const className = i <= level ? `heat-bar hot-${Math.min(i, 5)}` : 'heat-bar';
            bars += `<div class="${className}"></div>`;
        }
        return `<div class="heat-meter" title="Controversy Level: ${Math.round(controversyScore)}%">${bars}</div>`;
    }

    // Sponsor Management System
    loadSponsors() {
        const stored = localStorage.getItem('video-clipper-sponsors');
        return stored ? JSON.parse(stored) : {
            'aaron-day-show': {
                name: 'Aaron Day Show',
                logoData: null,
                rate: 0,
                isDefault: true
            }
        };
    }

    saveSponsors() {
        localStorage.setItem('video-clipper-sponsors', JSON.stringify(this.sponsors));
        this.updateSponsorSelect();
    }

    loadDailyStats() {
        const today = new Date().toDateString();
        const stored = localStorage.getItem('video-clipper-daily-stats');
        const stats = stored ? JSON.parse(stored) : {};
        
        if (!stats[today]) {
            stats[today] = { clips: 0, revenue: 0 };
        }
        
        return stats;
    }

    saveDailyStats() {
        localStorage.setItem('video-clipper-daily-stats', JSON.stringify(this.dailyStats));
        this.updateRevenueDisplay();
    }

    addSponsor(name, logoData, rate) {
        const sponsorId = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        this.sponsors[sponsorId] = {
            name: name,
            logoData: logoData,
            rate: parseFloat(rate) || 0,
            isDefault: false
        };
        this.saveSponsors();
        console.log(`💰 Added sponsor: ${name} at $${rate}/clip`);
    }

    getCurrentSponsor() {
        const selectedId = document.getElementById('sponsor-select').value;
        return selectedId ? this.sponsors[selectedId] : null;
    }

    updateSponsorSelect() {
        const select = document.getElementById('sponsor-select');
        const currentValue = select.value;
        
        select.innerHTML = '<option value="">Select Sponsor...</option>';
        
        Object.entries(this.sponsors).forEach(([id, sponsor]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${sponsor.name} ($${sponsor.rate}/clip)`;
            select.appendChild(option);
        });
        
        if (currentValue && this.sponsors[currentValue]) {
            select.value = currentValue;
            this.updateSponsorPreview();
        }
    }

    updateSponsorPreview() {
        const sponsor = this.getCurrentSponsor();
        const preview = document.getElementById('sponsor-preview');
        
        if (sponsor) {
            preview.classList.remove('hidden');
            document.getElementById('sponsor-preview-name').textContent = sponsor.name;
            document.getElementById('sponsor-preview-rate').textContent = `$${sponsor.rate}/clip`;
            
            if (sponsor.logoData) {
                document.getElementById('sponsor-preview-img').src = sponsor.logoData;
            }
        } else {
            preview.classList.add('hidden');
        }
    }

    trackClipGeneration(sponsorRate = 0) {
        const today = new Date().toDateString();
        if (!this.dailyStats[today]) {
            this.dailyStats[today] = { clips: 0, revenue: 0 };
        }
        
        this.dailyStats[today].clips += 1;
        this.dailyStats[today].revenue += sponsorRate;
        
        this.saveDailyStats();
        console.log(`💰 Clip generated! Revenue: $${sponsorRate}`);
    }

    updateRevenueDisplay() {
        const today = new Date().toDateString();
        const todayStats = this.dailyStats[today] || { clips: 0, revenue: 0 };
        
        document.getElementById('clips-today-count').textContent = todayStats.clips;
        document.getElementById('revenue-today').textContent = todayStats.revenue.toFixed(2);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    highlightText(text, searchTerm) {
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<mark class="bg-gold text-charcoal">$1</mark>');
    }
}

console.log('🔥 Creating VideoClipper instance...');
const clipper = new VideoClipper();
window.videoClipperApp = clipper; // Make it globally accessible
console.log('🔥 VideoClipper created, initializing...');
clipper.init().then(() => {
    console.log('🔥 VideoClipper initialization complete!');
}).catch(error => {
    console.error('❌ VideoClipper initialization failed:', error);
});