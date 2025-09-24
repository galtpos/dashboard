// VIRAL CONTENT GENERATION MACHINE
// Transform boring long-form into addictive short-form content

class ViralEngine {
    constructor() {
        this.viralityScores = new Map();
        this.controversyLevels = new Map();
        this.engagementPredictions = new Map();
        this.platformSpecs = {
            tiktok: { ratio: '9:16', duration: 60, hooks: 'shock', captions: 'large' },
            youtube: { ratio: '9:16', duration: 60, hooks: 'curiosity', captions: 'medium' },
            twitter: { ratio: '16:9', duration: 30, hooks: 'controversy', captions: 'small' },
            rumble: { ratio: '16:9', duration: 120, hooks: 'patriot', captions: 'medium' }
        };
    }

    // 🔥 VIRAL MOMENT DETECTION
    analyzeViralPotential(transcript) {
        const viralTriggers = [
            // Controversy triggers (HIGH VIRAL)
            { patterns: ['exposed', 'truth', 'they don\'t want', 'hidden', 'secret'], score: 95, type: 'controversy' },
            { patterns: ['government', 'control', 'agenda', 'manipulation', 'lies'], score: 90, type: 'conspiracy' },
            { patterns: ['wake up', 'sheep', 'brainwashed', 'propaganda'], score: 85, type: 'awakening' },
            
            // Emotional peaks (MEDIUM-HIGH VIRAL)
            { patterns: ['shocking', 'unbelievable', 'insane', 'crazy'], score: 80, type: 'emotion' },
            { patterns: ['you won\'t believe', 'this will blow your mind', 'nobody talks about'], score: 75, type: 'curiosity' },
            
            // Educational hooks (MEDIUM VIRAL)
            { patterns: ['here\'s how', 'the real reason', 'what they mean'], score: 70, type: 'education' },
            { patterns: ['most people don\'t know', 'the truth is', 'let me explain'], score: 65, type: 'authority' }
        ];

        const moments = [];
        const words = transcript.toLowerCase().split(' ');
        
        for (let i = 0; i < words.length - 10; i++) {
            const segment = words.slice(i, i + 50).join(' ');
            let maxScore = 0;
            let momentType = 'safe';
            
            viralTriggers.forEach(trigger => {
                const matches = trigger.patterns.filter(pattern => 
                    segment.includes(pattern.toLowerCase())
                ).length;
                
                if (matches > 0) {
                    const score = trigger.score * matches;
                    if (score > maxScore) {
                        maxScore = score;
                        momentType = trigger.type;
                    }
                }
            });
            
            if (maxScore > 60) {
                moments.push({
                    startTime: i * 0.5, // Rough time estimate
                    endTime: (i + 30) * 0.5,
                    score: maxScore,
                    type: momentType,
                    text: segment.substring(0, 100) + '...'
                });
            }
        }
        
        return moments.sort((a, b) => b.score - a.score);
    }

    // 🎯 SMART HOOK GENERATOR
    generateHooks(clipText, momentType) {
        const hookTemplates = {
            controversy: [
                "🚨 THEY DON'T WANT YOU TO KNOW THIS:",
                "💣 EXPOSED: The truth about",
                "⚠️ WARNING: This will change everything you believe about"
            ],
            conspiracy: [
                "🔍 HIDDEN TRUTH:",
                "🎭 THE MASK IS OFF:",
                "💀 THEY'RE LYING TO YOU ABOUT"
            ],
            awakening: [
                "⏰ WAKE UP CALL:",
                "🧠 TIME TO THINK:",
                "💡 MOST PEOPLE ARE BLIND TO THIS:"
            ],
            emotion: [
                "😱 YOU WON'T BELIEVE:",
                "🤯 MIND = BLOWN:",
                "🔥 THIS IS INSANE:"
            ]
        };

        const hooks = hookTemplates[momentType] || hookTemplates.controversy;
        return hooks.map(hook => ({
            text: hook,
            engagementScore: Math.floor(Math.random() * 20) + 80,
            retentionPrediction: Math.floor(Math.random() * 30) + 70
        }));
    }

    // 📊 CONTROVERSY SCORER
    scoreControversy(text) {
        const controversyKeywords = {
            extreme: ['government lies', 'deep state', 'they control', 'wake up sheep', 'propaganda'], // 95-100
            high: ['conspiracy', 'hidden agenda', 'they don\'t want', 'truth exposed', 'manipulation'], // 80-94
            medium: ['mainstream media', 'question everything', 'think for yourself', 'real truth'], // 60-79
            low: ['interesting point', 'consider this', 'another perspective', 'food for thought'] // 40-59
        };

        let score = 30; // Base safe score
        const lowerText = text.toLowerCase();

        Object.entries(controversyKeywords).forEach(([level, keywords]) => {
            const matches = keywords.filter(keyword => lowerText.includes(keyword)).length;
            if (matches > 0) {
                switch(level) {
                    case 'extreme': score = Math.max(score, 95 + matches * 2); break;
                    case 'high': score = Math.max(score, 80 + matches * 3); break;
                    case 'medium': score = Math.max(score, 60 + matches * 4); break;
                    case 'low': score = Math.max(score, 40 + matches * 5); break;
                }
            }
        });

        return Math.min(score, 100);
    }

    // 🎬 BATCH CLIP GENERATOR
    generateEpisodePackage(transcript, duration) {
        const viralMoments = this.analyzeViralPotential(transcript);
        const package = {
            mainHook: null,
            controversyClips: [],
            educationalClips: [],
            ctaClips: [],
            guestHighlights: []
        };

        // Main hook (highest viral moment)
        if (viralMoments.length > 0) {
            package.mainHook = {
                ...viralMoments[0],
                title: "🔥 MOST VIRAL MOMENT",
                platforms: ['tiktok', 'youtube', 'twitter'],
                hooks: this.generateHooks(viralMoments[0].text, viralMoments[0].type)
            };
        }

        // Controversy clips (top 5 spicy moments)
        package.controversyClips = viralMoments
            .filter(m => m.score > 80)
            .slice(0, 5)
            .map(moment => ({
                ...moment,
                title: "💣 CONTROVERSY CLIP",
                engagementPrediction: "HIGH COMMENTS + SHARES",
                platforms: ['twitter', 'rumble']
            }));

        // Educational clips (medium viral moments)
        package.educationalClips = viralMoments
            .filter(m => m.score >= 60 && m.score <= 80)
            .slice(0, 5)
            .map(moment => ({
                ...moment,
                title: "📚 EDUCATIONAL CLIP",
                engagementPrediction: "STEADY GROWTH",
                platforms: ['youtube', 'rumble']
            }));

        // CTA clips (last 2 minutes of episode)
        const ctaStart = Math.max(0, duration - 120);
        package.ctaClips = [{
            startTime: ctaStart,
            endTime: duration,
            title: "📢 CALL TO ACTION",
            text: "Subscribe, share, join the movement",
            platforms: ['all']
        }];

        return package;
    }

    // 🎨 CLICKBAIT TITLE GENERATOR
    generateClickbaitTitles(clipText, momentType) {
        const emotionalTriggers = [
            "This Changes EVERYTHING",
            "You've Been LIED To About",
            "The TRUTH They Don't Want You To Know",
            "EXPOSED: The Real Reason",
            "WARNING: This Will SHOCK You",
            "They're HIDING This From You",
            "The DARK Truth About",
            "This Will Make You ANGRY",
            "BREAKING: The Secret Behind",
            "You Won't BELIEVE What"
        ];

        const curiosityGaps = [
            "...and what happens next will blow your mind",
            "...but the ending will surprise you",
            "...and the truth is darker than you think",
            "...and everyone is falling for it",
            "...and they're doing it on purpose"
        ];

        const titles = [];
        for (let i = 0; i < 10; i++) {
            const trigger = emotionalTriggers[Math.floor(Math.random() * emotionalTriggers.length)];
            const gap = curiosityGaps[Math.floor(Math.random() * curiosityGaps.length)];
            
            titles.push({
                title: `${trigger} ${gap}`,
                ctrPrediction: Math.floor(Math.random() * 5) + 12, // 12-17% CTR
                curiosityScore: Math.floor(Math.random() * 20) + 80,
                emotionalImpact: Math.floor(Math.random() * 15) + 85
            });
        }

        return titles.sort((a, b) => b.ctrPrediction - a.ctrPrediction);
    }

    // 🎵 VIRAL REMIX TOOLS
    generateRemixTemplates(moment) {
        return {
            memeTemplate: {
                format: "reaction_gif",
                duration: 3,
                loop: true,
                text: "When someone says [insert topic]:"
            },
            beforeAfter: {
                format: "split_screen",
                left: "Problem/Threat",
                right: "Solution/Counter",
                transition: "dramatic_reveal"
            },
            quoteCard: {
                format: "text_overlay",
                background: "aaron_day_brand",
                animation: "typewriter_effect",
                cta: "Follow @TheAaronDayShow"
            },
            musicSync: {
                format: "beat_matched",
                genre: "epic_dramatic",
                cuts: "on_beat",
                buildup: true
            }
        };
    }

    // 🚀 ONE-CLICK VIRAL GENERATOR
    generateViralContent(transcript, selectedMoment) {
        const analysis = this.analyzeViralPotential(transcript);
        const moment = selectedMoment || analysis[0];
        
        if (!moment) return null;

        const hooks = this.generateHooks(moment.text, moment.type);
        const titles = this.generateClickbaitTitles(moment.text, moment.type);
        const controversyScore = this.scoreControversy(moment.text);
        
        return {
            moment,
            hooks: hooks.slice(0, 3),
            titles: titles.slice(0, 5),
            controversyScore,
            engagementPrediction: {
                comments: controversyScore > 80 ? "🔥 HIGH" : "📈 MEDIUM",
                shares: moment.score > 85 ? "🚀 VIRAL" : "📊 GOOD",
                saves: moment.type === 'education' ? "📚 HIGH" : "📋 MEDIUM"
            },
            platformRecommendations: this.recommendPlatforms(moment, controversyScore),
            remixOptions: this.generateRemixTemplates(moment)
        };
    }

    recommendPlatforms(moment, controversyScore) {
        const recommendations = [];
        
        if (controversyScore > 85) {
            recommendations.push({ platform: 'Twitter/X', reason: 'High controversy = engagement' });
            recommendations.push({ platform: 'Rumble', reason: 'Free speech friendly' });
        }
        
        if (moment.type === 'education') {
            recommendations.push({ platform: 'YouTube', reason: 'Educational content performs well' });
        }
        
        if (moment.score > 90) {
            recommendations.push({ platform: 'TikTok', reason: 'Viral potential detected' });
        }
        
        return recommendations;
    }
}

// Export for use in main app
window.ViralEngine = ViralEngine;


