// VIRAL CONTENT MACHINE DEBUG & INITIALIZATION
console.log('🔥 VIRAL DEBUG: Starting initialization...');

// Force initialization of viral features
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔥 VIRAL DEBUG: DOM loaded');
    
    // Wait a bit for main app to load
    setTimeout(() => {
        console.log('🔥 VIRAL DEBUG: Attempting to initialize viral features...');
        
        // Check if ViralEngine exists
        if (typeof ViralEngine === 'undefined') {
            console.error('❌ ViralEngine not loaded!');
            return;
        }
        console.log('✅ ViralEngine loaded');
        
        // Check if ViralUI exists  
        if (typeof ViralUI === 'undefined') {
            console.error('❌ ViralUI not loaded!');
            return;
        }
        console.log('✅ ViralUI loaded');
        
        // Force create viral UI
        if (!window.viralUI) {
            console.log('🔥 VIRAL DEBUG: Creating ViralUI instance...');
            window.viralEngine = new ViralEngine();
            window.viralUI = new ViralUI(window.videoClipper || {});
            console.log('✅ Viral UI created!');
            
            // Add visual indicator that viral mode is active
            const indicator = document.createElement('div');
            indicator.id = 'viral-indicator';
            indicator.innerHTML = '🔥 VIRAL MODE ACTIVE 🔥';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: linear-gradient(45deg, #dc2626, #ea580c);
                color: white;
                padding: 8px 16px;
                border-radius: 25px;
                font-weight: bold;
                font-size: 12px;
                z-index: 9999;
                animation: pulse 2s infinite;
                box-shadow: 0 0 20px rgba(220, 38, 38, 0.5);
            `;
            document.body.appendChild(indicator);
            
            // Add pulse animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 0.8; }
                    50% { transform: scale(1.05); opacity: 1; }
                    100% { transform: scale(1); opacity: 0.8; }
                }
            `;
            document.head.appendChild(style);
            
        } else {
            console.log('✅ Viral UI already exists');
        }
        
        // Test viral engine functionality
        console.log('🔥 VIRAL DEBUG: Testing viral engine...');
        const testTranscript = "They exposed the hidden truth about government control that they don't want you to know. Wake up, sheep!";
        const moments = window.viralEngine.analyzeViralPotential(testTranscript);
        console.log(`✅ Found ${moments.length} viral moments:`, moments);
        
        const hooks = window.viralEngine.generateHooks(testTranscript, 'controversy');
        console.log(`✅ Generated ${hooks.length} viral hooks:`, hooks);
        
        console.log('🎉 VIRAL CONTENT MACHINE FULLY OPERATIONAL!');
        
        // Show success message
        setTimeout(() => {
            if (window.viralUI && window.viralUI.showResults) {
                window.viralUI.showResults('🔥 VIRAL CONTENT MACHINE ACTIVATED! Ready to dominate the internet! 🚀');
            }
        }, 1000);
        
    }, 2000); // Wait 2 seconds for everything to load
});

// Also try immediate initialization if DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('🔥 VIRAL DEBUG: DOM already ready, initializing immediately...');
    setTimeout(() => {
        if (typeof ViralEngine !== 'undefined' && typeof ViralUI !== 'undefined' && !window.viralUI) {
            window.viralEngine = new ViralEngine();
            window.viralUI = new ViralUI(window.videoClipper || {});
            console.log('🔥 VIRAL DEBUG: Immediate initialization complete!');
        }
    }, 500);
}


