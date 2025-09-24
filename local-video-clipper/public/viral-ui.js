// VIRAL CONTENT UI - The most aggressive content generation interface ever built
class ViralUI {
    constructor(videoClipper) {
        this.videoClipper = videoClipper;
        this.viralEngine = new ViralEngine();
        this.currentAnalysis = null;
        this.viralMoments = [];
        this.init();
    }

    init() {
        this.addViralTab();
        this.enhanceExistingUI();
        this.addViralControls();
    }

    // Add the 🔥 VIRAL MOMENTS tab
    addViralTab() {
        const tabsContainer = document.querySelector('.tab-buttons') || this.createTabsContainer();
        
        const viralTab = document.createElement('button');
        viralTab.className = 'tab-button';
        viralTab.innerHTML = '🔥 VIRAL MOMENTS';
        viralTab.onclick = () => this.showViralTab();
        
        tabsContainer.appendChild(viralTab);
        
        // Create viral content area
        const contentArea = document.getElementById('transcript-content').parentElement;
        const viralArea = document.createElement('div');
        viralArea.id = 'viral-content';
        viralArea.className = 'hidden';
        viralArea.innerHTML = this.getViralHTML();
        
        contentArea.appendChild(viralArea);
    }

    createTabsContainer() {
        const container = document.createElement('div');
        container.className = 'tab-buttons flex space-x-2 mb-4';
        
        const transcriptSection = document.getElementById('transcript-content').parentElement;
        transcriptSection.insertBefore(container, transcriptSection.firstChild);
        
        // Add existing transcript tab
        const transcriptTab = document.createElement('button');
        transcriptTab.className = 'tab-button bg-amber text-charcoal px-4 py-2 rounded font-medium';
        transcriptTab.innerHTML = '📄 Transcript';
        transcriptTab.onclick = () => this.showTranscriptTab();
        container.appendChild(transcriptTab);
        
        return container;
    }

    getViralHTML() {
        return `
            <div class="viral-machine bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-500/30 rounded-lg p-6">
                <!-- VIRAL HEADER -->
                <div class="text-center mb-6">
                    <h2 class="text-2xl font-bold text-red-400 mb-2">🔥 VIRAL CONTENT MACHINE 🔥</h2>
                    <p class="text-light-gray">Transform boring long-form into addictive short-form content</p>
                </div>

                <!-- ANALYZE BUTTON -->
                <div class="text-center mb-6">
                    <button id="analyze-viral" class="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white px-8 py-3 rounded-lg font-bold text-lg transform hover:scale-105 transition-all">
                        🚀 ANALYZE FOR VIRAL MOMENTS
                    </button>
                </div>

                <!-- VIRAL MOMENTS LIST -->
                <div id="viral-moments-list" class="hidden">
                    <h3 class="text-xl font-bold text-sand mb-4">🎯 VIRAL MOMENTS DETECTED</h3>
                    <div id="moments-container" class="space-y-4 mb-6"></div>
                </div>

                <!-- EPISODE PACKAGE GENERATOR -->
                <div id="episode-package" class="hidden mb-6">
                    <div class="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-lg p-4">
                        <h3 class="text-xl font-bold text-purple-400 mb-3">📦 EPISODE PACKAGE GENERATOR</h3>
                        <p class="text-light-gray mb-4">Generate 10-15 clips automatically optimized for maximum engagement</p>
                        <button id="generate-package" class="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-lg font-bold hover:scale-105 transition-all">
                            ⚡ GENERATE VIRAL PACKAGE
                        </button>
                    </div>
                </div>

                <!-- PLATFORM EXPORT BUTTONS -->
                <div id="platform-exports" class="hidden">
                    <h3 class="text-xl font-bold text-sand mb-4">🎬 MULTI-PLATFORM EXPORT</h3>
                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <button class="platform-btn bg-black text-white" data-platform="tiktok">
                            📱 TikTok/Reel<br><small>9:16 • 60s • Shock Hooks</small>
                        </button>
                        <button class="platform-btn bg-red-600 text-white" data-platform="youtube">
                            📺 YouTube Short<br><small>9:16 • 60s • Curiosity</small>
                        </button>
                        <button class="platform-btn bg-blue-500 text-white" data-platform="twitter">
                            🐦 X/Twitter<br><small>16:9 • 30s • Controversy</small>
                        </button>
                        <button class="platform-btn bg-green-600 text-white" data-platform="rumble">
                            🎥 Rumble<br><small>16:9 • 120s • Patriot</small>
                        </button>
                    </div>
                </div>

                <!-- VIRAL TOOLS -->
                <div id="viral-tools" class="hidden">
                    <h3 class="text-xl font-bold text-sand mb-4">🛠️ VIRAL ENHANCEMENT TOOLS</h3>
                    <div class="grid grid-cols-2 gap-4">
                        <button id="hook-generator" class="tool-btn bg-yellow-600">
                            🎣 Smart Hooks<br><small>AI-powered openings</small>
                        </button>
                        <button id="title-generator" class="tool-btn bg-orange-600">
                            📝 Clickbait Titles<br><small>10 viral options</small>
                        </button>
                        <button id="controversy-analyzer" class="tool-btn bg-red-600">
                            💣 Controversy Score<br><small>Engagement predictor</small>
                        </button>
                        <button id="remix-tools" class="tool-btn bg-purple-600">
                            🎨 Viral Remixes<br><small>Memes & templates</small>
                        </button>
                    </div>
                </div>

                <!-- RESULTS AREA -->
                <div id="viral-results" class="hidden mt-6">
                    <div class="bg-dark-gray/50 border border-border rounded-lg p-4">
                        <h4 class="font-bold text-sand mb-2">🎯 GENERATION RESULTS</h4>
                        <div id="results-content"></div>
                    </div>
                </div>
            </div>
        `;
    }

    showViralTab() {
        // Hide transcript, show viral
        document.getElementById('transcript-content').classList.add('hidden');
        document.getElementById('viral-content').classList.remove('hidden');
        
        // Update tab styles
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.className = 'tab-button bg-surface text-sand px-4 py-2 rounded font-medium hover:bg-border transition-colors';
        });
        event.target.className = 'tab-button bg-amber text-charcoal px-4 py-2 rounded font-medium';
        
        this.bindViralEvents();
    }

    showTranscriptTab() {
        document.getElementById('viral-content').classList.add('hidden');
        document.getElementById('transcript-content').classList.remove('hidden');
        
        // Update tab styles
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.className = 'tab-button bg-surface text-sand px-4 py-2 rounded font-medium hover:bg-border transition-colors';
        });
        event.target.className = 'tab-button bg-amber text-charcoal px-4 py-2 rounded font-medium';
    }

    bindViralEvents() {
        // Analyze viral moments
        const analyzeBtn = document.getElementById('analyze-viral');
        if (analyzeBtn && !analyzeBtn.hasListener) {
            analyzeBtn.hasListener = true;
            analyzeBtn.onclick = () => this.analyzeCurrentTranscript();
        }

        // Generate episode package
        const packageBtn = document.getElementById('generate-package');
        if (packageBtn && !packageBtn.hasListener) {
            packageBtn.hasListener = true;
            packageBtn.onclick = () => this.generateEpisodePackage();
        }

        // Platform export buttons
        document.querySelectorAll('.platform-btn').forEach(btn => {
            if (!btn.hasListener) {
                btn.hasListener = true;
                btn.onclick = () => this.exportToPlatform(btn.dataset.platform);
            }
        });

        // Viral tools
        this.bindViralTools();
    }

    bindViralTools() {
        const tools = {
            'hook-generator': () => this.generateHooks(),
            'title-generator': () => this.generateTitles(),
            'controversy-analyzer': () => this.analyzeControversy(),
            'remix-tools': () => this.showRemixTools()
        };

        Object.entries(tools).forEach(([id, handler]) => {
            const btn = document.getElementById(id);
            if (btn && !btn.hasListener) {
                btn.hasListener = true;
                btn.onclick = handler;
            }
        });
    }

    analyzeCurrentTranscript() {
        const transcriptText = this.getTranscriptText();
        if (!transcriptText) {
            this.showResults('❌ No transcript loaded. Select an episode first.');
            return;
        }

        this.showResults('🔄 Analyzing transcript for viral moments...');
        
        // Simulate analysis delay for dramatic effect
        setTimeout(() => {
            this.viralMoments = this.viralEngine.analyzeViralPotential(transcriptText);
            this.displayViralMoments();
            this.showViralTools();
        }, 1500);
    }

    getTranscriptText() {
        const segments = document.querySelectorAll('.transcript-segment');
        if (segments.length === 0) return null;
        
        return Array.from(segments)
            .map(segment => segment.textContent)
            .join(' ');
    }

    displayViralMoments() {
        const container = document.getElementById('moments-container');
        const listElement = document.getElementById('viral-moments-list');
        
        if (this.viralMoments.length === 0) {
            this.showResults('😴 No viral moments detected. This content needs more spice!');
            return;
        }

        listElement.classList.remove('hidden');
        container.innerHTML = '';

        this.viralMoments.slice(0, 10).forEach((moment, index) => {
            const momentElement = document.createElement('div');
            momentElement.className = `viral-moment p-4 rounded-lg border cursor-pointer hover:scale-105 transition-all ${this.getScoreColor(moment.score)}`;
            
            momentElement.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center space-x-2">
                        <span class="text-2xl">${this.getViralEmoji(moment.type)}</span>
                        <span class="font-bold text-sand">${moment.type.toUpperCase()}</span>
                        <span class="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">${moment.score}/100</span>
                    </div>
                    <button class="generate-clip-btn bg-amber text-charcoal px-3 py-1 rounded font-bold text-sm hover:bg-gold transition-colors" data-moment-index="${index}">
                        🚀 GENERATE CLIP
                    </button>
                </div>
                <div class="text-light-gray text-sm mb-2">
                    ${this.formatTime(moment.startTime)} - ${this.formatTime(moment.endTime)}
                </div>
                <div class="text-sand">${moment.text}</div>
                <div class="mt-2 text-xs text-light-gray/60">
                    Predicted: ${this.getPrediction(moment.score)}
                </div>
            `;

            // Bind click to generate clip
            const generateBtn = momentElement.querySelector('.generate-clip-btn');
            generateBtn.onclick = (e) => {
                e.stopPropagation();
                this.generateViralClip(moment);
            };

            container.appendChild(momentElement);
        });

        this.showResults(`🎯 Found ${this.viralMoments.length} viral moments! Click any moment to generate clips.`);
    }

    getScoreColor(score) {
        if (score >= 90) return 'border-red-500 bg-red-900/20';
        if (score >= 75) return 'border-orange-500 bg-orange-900/20';
        if (score >= 60) return 'border-yellow-500 bg-yellow-900/20';
        return 'border-gray-500 bg-gray-900/20';
    }

    getViralEmoji(type) {
        const emojis = {
            controversy: '💣',
            conspiracy: '🎭',
            awakening: '💡',
            emotion: '😱',
            curiosity: '🤔',
            education: '📚',
            authority: '👑'
        };
        return emojis[type] || '🔥';
    }

    getPrediction(score) {
        if (score >= 95) return '🚀 GUARANTEED VIRAL';
        if (score >= 85) return '🔥 HIGH ENGAGEMENT';
        if (score >= 70) return '📈 GOOD REACH';
        return '📊 STEADY GROWTH';
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    generateViralClip(moment) {
        this.showResults('⚡ Generating viral clip with AI enhancements...');
        
        // Create the clip with viral enhancements
        const viralContent = this.viralEngine.generateViralContent(this.getTranscriptText(), moment);
        
        setTimeout(() => {
            this.displayViralResults(viralContent);
            this.showPlatformExports();
        }, 1000);
    }

    displayViralResults(content) {
        const resultsDiv = document.getElementById('results-content');
        
        resultsDiv.innerHTML = `
            <div class="space-y-4">
                <!-- Controversy Score -->
                <div class="flex items-center justify-between p-3 bg-red-900/20 border border-red-500/30 rounded">
                    <span class="text-red-400 font-bold">🌶️ CONTROVERSY SCORE</span>
                    <span class="text-white font-bold text-xl">${content.controversyScore}/100</span>
                </div>

                <!-- Engagement Prediction -->
                <div class="grid grid-cols-3 gap-2 text-center">
                    <div class="bg-blue-900/20 border border-blue-500/30 rounded p-2">
                        <div class="text-blue-400 font-bold">Comments</div>
                        <div class="text-white">${content.engagementPrediction.comments}</div>
                    </div>
                    <div class="bg-green-900/20 border border-green-500/30 rounded p-2">
                        <div class="text-green-400 font-bold">Shares</div>
                        <div class="text-white">${content.engagementPrediction.shares}</div>
                    </div>
                    <div class="bg-purple-900/20 border border-purple-500/30 rounded p-2">
                        <div class="text-purple-400 font-bold">Saves</div>
                        <div class="text-white">${content.engagementPrediction.saves}</div>
                    </div>
                </div>

                <!-- Top Hooks -->
                <div>
                    <h4 class="text-yellow-400 font-bold mb-2">🎣 TOP VIRAL HOOKS</h4>
                    ${content.hooks.map(hook => `
                        <div class="bg-yellow-900/20 border border-yellow-500/30 rounded p-2 mb-2">
                            <div class="font-bold text-white">${hook.text}</div>
                            <div class="text-xs text-yellow-300">Engagement: ${hook.engagementScore}% • Retention: ${hook.retentionPrediction}%</div>
                        </div>
                    `).join('')}
                </div>

                <!-- Platform Recommendations -->
                <div>
                    <h4 class="text-cyan-400 font-bold mb-2">🎯 PLATFORM RECOMMENDATIONS</h4>
                    ${content.platformRecommendations.map(rec => `
                        <div class="bg-cyan-900/20 border border-cyan-500/30 rounded p-2 mb-1">
                            <span class="font-bold text-white">${rec.platform}</span>
                            <span class="text-cyan-300 text-sm ml-2">${rec.reason}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.getElementById('viral-results').classList.remove('hidden');
    }

    showViralTools() {
        document.getElementById('viral-tools').classList.remove('hidden');
    }

    showPlatformExports() {
        document.getElementById('platform-exports').classList.remove('hidden');
    }

    generateEpisodePackage() {
        const transcriptText = this.getTranscriptText();
        if (!transcriptText) {
            this.showResults('❌ No transcript loaded.');
            return;
        }

        this.showResults('📦 Generating complete episode package...');
        
        setTimeout(() => {
            const package = this.viralEngine.generateEpisodePackage(transcriptText, 3600); // Assume 1 hour episode
            this.displayEpisodePackage(package);
        }, 2000);
    }

    displayEpisodePackage(package) {
        let html = '<div class="space-y-6">';
        
        // Main Hook
        if (package.mainHook) {
            html += `
                <div class="bg-gradient-to-r from-red-900/30 to-orange-900/30 border border-red-500/30 rounded-lg p-4">
                    <h4 class="text-red-400 font-bold text-lg mb-2">🔥 MAIN HOOK CLIP</h4>
                    <p class="text-white mb-2">${package.mainHook.text}</p>
                    <div class="flex space-x-2">
                        ${package.mainHook.platforms.map(p => `<span class="bg-red-500 text-white px-2 py-1 rounded text-xs">${p.toUpperCase()}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        // Controversy Clips
        if (package.controversyClips.length > 0) {
            html += `
                <div class="bg-gradient-to-r from-orange-900/30 to-red-900/30 border border-orange-500/30 rounded-lg p-4">
                    <h4 class="text-orange-400 font-bold text-lg mb-2">💣 CONTROVERSY CLIPS (${package.controversyClips.length})</h4>
                    ${package.controversyClips.map(clip => `
                        <div class="bg-orange-900/20 rounded p-2 mb-2">
                            <div class="text-white text-sm">${clip.text}</div>
                            <div class="text-orange-300 text-xs mt-1">${clip.engagementPrediction}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Educational Clips
        if (package.educationalClips.length > 0) {
            html += `
                <div class="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-lg p-4">
                    <h4 class="text-blue-400 font-bold text-lg mb-2">📚 EDUCATIONAL CLIPS (${package.educationalClips.length})</h4>
                    ${package.educationalClips.map(clip => `
                        <div class="bg-blue-900/20 rounded p-2 mb-2">
                            <div class="text-white text-sm">${clip.text}</div>
                            <div class="text-blue-300 text-xs mt-1">${clip.engagementPrediction}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        html += '</div>';
        
        this.showResults(`📦 EPISODE PACKAGE GENERATED! ${package.controversyClips.length + package.educationalClips.length + 1} clips ready for viral domination.`);
        document.getElementById('results-content').innerHTML = html;
        document.getElementById('viral-results').classList.remove('hidden');
    }

    exportToPlatform(platform) {
        const specs = this.viralEngine.platformSpecs[platform];
        this.showResults(`🎬 Exporting to ${platform.toUpperCase()}...\nFormat: ${specs.ratio} • Duration: ${specs.duration}s • Hook Style: ${specs.hooks}`);
        
        // Simulate export process
        setTimeout(() => {
            this.showResults(`✅ ${platform.toUpperCase()} export complete! Optimized for maximum ${specs.hooks} engagement.`);
        }, 1500);
    }

    generateHooks() {
        const transcriptText = this.getTranscriptText();
        if (!transcriptText) return;
        
        const hooks = this.viralEngine.generateHooks(transcriptText, 'controversy');
        
        let html = '<div class="space-y-2">';
        hooks.forEach(hook => {
            html += `
                <div class="bg-yellow-900/20 border border-yellow-500/30 rounded p-3">
                    <div class="font-bold text-white">${hook.text}</div>
                    <div class="text-yellow-300 text-sm">Engagement: ${hook.engagementScore}% • Retention: ${hook.retentionPrediction}%</div>
                </div>
            `;
        });
        html += '</div>';
        
        document.getElementById('results-content').innerHTML = html;
        document.getElementById('viral-results').classList.remove('hidden');
    }

    generateTitles() {
        const transcriptText = this.getTranscriptText();
        if (!transcriptText) return;
        
        const titles = this.viralEngine.generateClickbaitTitles(transcriptText, 'controversy');
        
        let html = '<div class="space-y-2">';
        titles.forEach((title, index) => {
            html += `
                <div class="bg-orange-900/20 border border-orange-500/30 rounded p-3">
                    <div class="font-bold text-white">#${index + 1}: ${title.title}</div>
                    <div class="text-orange-300 text-sm">CTR: ${title.ctrPrediction}% • Curiosity: ${title.curiosityScore}/100</div>
                </div>
            `;
        });
        html += '</div>';
        
        document.getElementById('results-content').innerHTML = html;
        document.getElementById('viral-results').classList.remove('hidden');
    }

    analyzeControversy() {
        const transcriptText = this.getTranscriptText();
        if (!transcriptText) return;
        
        const score = this.viralEngine.scoreControversy(transcriptText);
        
        let level = 'SAFE';
        let color = 'green';
        let advice = 'Add more spice for viral potential!';
        
        if (score >= 85) {
            level = 'EXPLOSIVE';
            color = 'red';
            advice = 'Maximum viral potential! Prepare for engagement storm.';
        } else if (score >= 70) {
            level = 'SPICY';
            color = 'orange';
            advice = 'High engagement expected. Perfect for growth.';
        } else if (score >= 50) {
            level = 'MILD';
            color = 'yellow';
            advice = 'Moderate engagement. Consider adding controversy.';
        }
        
        const html = `
            <div class="text-center">
                <div class="text-6xl mb-4">${score >= 85 ? '🌶️🔥' : score >= 70 ? '🌶️' : score >= 50 ? '😐' : '😴'}</div>
                <div class="text-2xl font-bold text-${color}-400 mb-2">${level}</div>
                <div class="text-4xl font-bold text-white mb-4">${score}/100</div>
                <div class="text-${color}-300">${advice}</div>
            </div>
        `;
        
        document.getElementById('results-content').innerHTML = html;
        document.getElementById('viral-results').classList.remove('hidden');
    }

    showRemixTools() {
        const html = `
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-purple-900/20 border border-purple-500/30 rounded p-4 text-center">
                    <div class="text-2xl mb-2">🎭</div>
                    <div class="font-bold text-white">Meme Template</div>
                    <div class="text-purple-300 text-sm">Reaction GIF generator</div>
                </div>
                <div class="bg-pink-900/20 border border-pink-500/30 rounded p-4 text-center">
                    <div class="text-2xl mb-2">⚡</div>
                    <div class="font-bold text-white">Before/After</div>
                    <div class="text-pink-300 text-sm">Split-screen reveal</div>
                </div>
                <div class="bg-cyan-900/20 border border-cyan-500/30 rounded p-4 text-center">
                    <div class="text-2xl mb-2">💬</div>
                    <div class="font-bold text-white">Quote Card</div>
                    <div class="text-cyan-300 text-sm">Branded text overlay</div>
                </div>
                <div class="bg-green-900/20 border border-green-500/30 rounded p-4 text-center">
                    <div class="text-2xl mb-2">🎵</div>
                    <div class="font-bold text-white">Music Sync</div>
                    <div class="text-green-300 text-sm">Beat-matched cuts</div>
                </div>
            </div>
        `;
        
        document.getElementById('results-content').innerHTML = html;
        document.getElementById('viral-results').classList.remove('hidden');
    }

    showResults(message) {
        const resultsArea = document.getElementById('viral-results');
        const resultsContent = document.getElementById('results-content');
        
        resultsContent.innerHTML = `<div class="text-center text-sand">${message}</div>`;
        resultsArea.classList.remove('hidden');
    }

    // Enhance existing UI with viral features
    enhanceExistingUI() {
        // Add viral score to existing segments
        this.addViralScoresToSegments();
        
        // Replace generate button with multi-platform buttons
        this.enhanceGenerateButtons();
        
        // Add viral heatmap to video timeline (if exists)
        this.addViralHeatmap();
    }

    addViralScoresToSegments() {
        // This would analyze each transcript segment and add viral scores
        // Implementation would depend on existing transcript structure
    }

    enhanceGenerateButtons() {
        // Find existing generate buttons and enhance them
        const generateBtns = document.querySelectorAll('button[id*="generate"], button[class*="generate"]');
        
        generateBtns.forEach(btn => {
            if (!btn.enhanced) {
                btn.enhanced = true;
                const originalText = btn.textContent;
                btn.innerHTML = `🚀 ${originalText} (VIRAL MODE)`;
                btn.className += ' bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600';
            }
        });
    }

    addViralHeatmap() {
        // Would add a visual heatmap showing viral potential across the timeline
        // This is a placeholder for future implementation
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for main VideoClipper to be ready
    const initViral = () => {
        if (window.videoClipper) {
            window.viralUI = new ViralUI(window.videoClipper);
            console.log('🔥 VIRAL CONTENT MACHINE ACTIVATED');
        } else {
            setTimeout(initViral, 500);
        }
    };
    
    initViral();
});

// Export for global access
window.ViralUI = ViralUI;


