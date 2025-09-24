// Master Dashboard Manager
console.log('🚀 Master Dashboard Manager Loading...');

class MasterDashboard {
    constructor() {
        this.activeTab = 'music';
        this.tabs = [
            'music',
            'video-clipper',
            'podcast-automation',
            'content-generation',
            'analytics-insights',
            'distribution-hub',
            'audience-management',
            'system-monitoring',
            'campaign-manager',
            'social-media'
        ];
        
        this.init();
    }
    
    init() {
        this.setupTabSwitching();
        this.showTab('music'); // Default to music tab
        console.log('✅ Master Dashboard initialized with', this.tabs.length, 'tabs');
    }
    
    setupTabSwitching() {
        // Add click listeners to all dashboard tabs
        document.querySelectorAll('.dashboard-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.target.getAttribute('data-tab');
                this.showTab(tabId);
            });
        });
    }
    
    showTab(tabId) {
        // Hide all tab panels
        this.tabs.forEach(id => {
            const panel = document.getElementById(`${id}-tab`);
            const button = document.querySelector(`[data-tab="${id}"]`);
            
            if (panel) {
                panel.classList.add('hidden');
                panel.classList.remove('active');
            }
            
            if (button) {
                button.classList.remove('active');
            }
        });
        
        // Show the selected tab
        const activePanel = document.getElementById(`${tabId}-tab`);
        const activeButton = document.querySelector(`[data-tab="${tabId}"]`);
        
        if (activePanel) {
            activePanel.classList.remove('hidden');
            activePanel.classList.add('active');
        }
        
        if (activeButton) {
            activeButton.classList.add('active');
        }
        
        this.activeTab = tabId;
        console.log(`🔄 Switched to tab: ${tabId}`);
        
        // Trigger tab-specific initialization if needed
        this.onTabActivated(tabId);
    }
    
    onTabActivated(tabId) {
        switch(tabId) {
            case 'music':
                this.initMusic();
                break;
            case 'video-clipper':
                // Video clipper is already initialized by existing app.js
                break;
            case 'podcast-automation':
                this.initPodcastAutomation();
                break;
            case 'content-generation':
                this.initContentGeneration();
                break;
            case 'analytics-insights':
                this.initAnalytics();
                break;
            case 'distribution-hub':
                this.initDistribution();
                break;
            case 'audience-management':
                this.initAudienceManagement();
                break;
            case 'system-monitoring':
                this.initSystemMonitoring();
                break;
            case 'campaign-manager':
                this.initCampaignManager();
                break;
        }
    }
    
    // Tab-specific initialization methods
    initMusic() {
        console.log('🎵 Initializing Music & Lyric Integration...');
        // Music functionality is handled by music.js
        // Just ensure the elements are ready
        const downloadSrt = document.getElementById('download-srt');
        const downloadLrc = document.getElementById('download-lrc');
        
        if (downloadSrt && downloadLrc) {
            console.log('✅ Music tab controls found and ready');
        } else {
            console.warn('⚠️ Music tab controls not found');
        }
    }
    
    initPodcastAutomation() {
        console.log('🎙️ Initializing Podcast Automation...');
        // Future: Auto-detect recordings, generate transcripts, etc.
    }
    
    initContentGeneration() {
        console.log('📝 Initializing Content Generation...');
        // Future: Voice profile integration, article generation, etc.
    }
    
    initAnalytics() {
        console.log('📊 Initializing Analytics & Insights...');
        // Future: Cross-platform analytics, engagement tracking, etc.
    }
    
    initDistribution() {
        console.log('🔄 Initializing Distribution Hub...');
        // Future: Multi-platform publishing, scheduling, etc.
    }
    
    initAudienceManagement() {
        console.log('📧 Initializing Audience Management...');
        // Future: Email campaigns, subscriber analytics, etc.
    }
    
    initSystemMonitoring() {
        console.log('⚙️ Initializing System Monitoring...');
        // Future: Server status, process monitoring, etc.
    }
    
    initCampaignManager() {
        console.log('🎯 Initializing Campaign Manager...');
        // Future: Event-driven workflows, progress monitoring, etc.
    }
    
    // Public API methods
    getCurrentTab() {
        return this.activeTab;
    }
    
    switchTo(tabId) {
        if (this.tabs.includes(tabId)) {
            this.showTab(tabId);
            return true;
        }
        console.warn(`⚠️ Tab '${tabId}' not found`);
        return false;
    }
    
    // Status reporting
    showStatus(message, isError = false) {
        const statusBar = document.getElementById('status-bar');
        const statusText = document.getElementById('status-text');
        
        if (statusBar && statusText) {
            statusText.textContent = message;
            statusText.className = isError ? 'text-sm text-red-400' : 'text-sm text-neon-teal';
            statusBar.classList.remove('hidden');
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                statusBar.classList.add('hidden');
            }, 5000);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔥 DOM loaded, initializing Master Dashboard...');
    window.masterDashboard = new MasterDashboard();
    
    // Show welcome message
    setTimeout(() => {
        if (window.masterDashboard) {
            window.masterDashboard.showStatus('🚀 Master Automation Dashboard Online - Ready for Content Warfare!');
        }
    }, 1000);
});
