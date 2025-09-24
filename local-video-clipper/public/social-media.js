// Social Media Scheduler for Aaron Day Show Dashboard
// Supports @aaronrday and @theaarondayshow accounts
// Features: Unlimited character posts with auto-threading, scheduling, drafts

class SocialMediaScheduler {
    constructor() {
        this.accounts = {
            'aaronrday': {
                name: '@aaronrday',
                displayName: 'Aaron Day',
                apiKey: null, // To be set via settings
                posts: [],
                drafts: [],
                scheduled: []
            },
            'theaarondayshow': {
                name: '@theaarondayshow', 
                displayName: 'The Aaron Day Show',
                apiKey: null,
                posts: [],
                drafts: [],
                scheduled: []
            }
        };
        
        this.currentAccount = 'aaronrday';
        this.maxTweetLength = 280;
        this.scheduledPosts = this.loadScheduledPosts();
        this.drafts = this.loadDrafts();
        
        this.initializeEventListeners();
        this.updateStats();
    }

    initializeEventListeners() {
        // Character count and threading
        const postContent = document.getElementById('social-post-content');
        if (postContent) {
            postContent.addEventListener('input', () => this.updateCharacterCount());
        }

        // Account selection
        const accountSelect = document.getElementById('social-account-select');
        if (accountSelect) {
            accountSelect.addEventListener('change', (e) => {
                this.currentAccount = e.target.value;
                this.updateStats();
            });
        }

        // Action buttons
        const postNowBtn = document.getElementById('post-now-btn');
        if (postNowBtn) {
            postNowBtn.addEventListener('click', () => this.postNow());
        }

        const scheduleBtn = document.getElementById('schedule-post-btn');
        if (scheduleBtn) {
            scheduleBtn.addEventListener('click', () => this.schedulePost());
        }

        const saveDraftBtn = document.getElementById('save-draft-btn');
        if (saveDraftBtn) {
            saveDraftBtn.addEventListener('click', () => this.saveDraft());
        }

        // Set default date/time
        this.setDefaultDateTime();
    }

    updateCharacterCount() {
        const postContent = document.getElementById('social-post-content');
        const characterCount = document.getElementById('character-count');
        const threadInfo = document.getElementById('thread-info');
        
        if (!postContent || !characterCount || !threadInfo) return;

        const content = postContent.value;
        const length = content.length;
        
        characterCount.textContent = `${length} characters`;
        
        if (length === 0) {
            threadInfo.textContent = 'Single post';
            threadInfo.className = 'text-sm text-neon-secondary';
        } else if (length <= this.maxTweetLength) {
            threadInfo.textContent = 'Single post';
            threadInfo.className = 'text-sm text-neon-teal';
        } else {
            const threadCount = this.calculateThreadCount(content);
            threadInfo.textContent = `Thread (${threadCount} posts)`;
            threadInfo.className = 'text-sm text-neon-pink';
        }
    }

    calculateThreadCount(content) {
        if (content.length <= this.maxTweetLength) return 1;
        
        // Split by natural breaks (sentences, paragraphs)
        const sentences = content.split(/[.!?]\s+/).filter(s => s.trim());
        const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
        
        // Use paragraphs if they exist, otherwise sentences
        const chunks = paragraphs.length > 1 ? paragraphs : sentences;
        
        let threadCount = 0;
        let currentLength = 0;
        
        for (const chunk of chunks) {
            if (currentLength + chunk.length > this.maxTweetLength - 10) { // -10 for thread numbering
                threadCount++;
                currentLength = chunk.length;
            } else {
                currentLength += chunk.length + 1; // +1 for space
            }
        }
        
        return Math.max(1, threadCount + 1);
    }

    createThread(content) {
        if (content.length <= this.maxTweetLength) {
            return [content];
        }

        const sentences = content.split(/[.!?]\s+/).filter(s => s.trim());
        const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
        
        // Use paragraphs if they exist, otherwise sentences
        const chunks = paragraphs.length > 1 ? paragraphs : sentences;
        const thread = [];
        let currentPost = '';
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i].trim();
            const threadNumber = ` ${thread.length + 1}/${this.calculateThreadCount(content)}`;
            
            if (currentPost.length + chunk.length + threadNumber.length <= this.maxTweetLength) {
                currentPost += (currentPost ? ' ' : '') + chunk;
            } else {
                if (currentPost) {
                    thread.push(currentPost + ` ${thread.length + 1}/${this.calculateThreadCount(content)}`);
                }
                currentPost = chunk;
            }
        }
        
        if (currentPost) {
            thread.push(currentPost + ` ${thread.length + 1}/${this.calculateThreadCount(content)}`);
        }
        
        return thread;
    }

    async postNow() {
        const content = document.getElementById('social-post-content').value.trim();
        if (!content) {
            this.showNotification('Please enter some content to post', 'error');
            return;
        }

        try {
            const thread = this.createThread(content);
            
            // Simulate API call (replace with actual X API integration)
            this.showNotification('Posting to X...', 'info');
            
            // For now, just simulate the post
            await this.simulatePost(thread);
            
            // Clear the form
            document.getElementById('social-post-content').value = '';
            this.updateCharacterCount();
            this.updateStats();
            
            this.showNotification(`Successfully posted ${thread.length > 1 ? 'thread' : 'post'} to ${this.accounts[this.currentAccount].name}!`, 'success');
            
        } catch (error) {
            console.error('Error posting:', error);
            this.showNotification('Failed to post. Please try again.', 'error');
        }
    }

    async simulatePost(thread) {
        try {
            // Call the actual API endpoint
            const response = await fetch('/api/social-media/post', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    account: this.currentAccount,
                    content: thread,
                    type: 'immediate'
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Add to posts history
            const post = {
                id: result.postId || Date.now(),
                account: this.currentAccount,
                content: thread,
                timestamp: new Date(result.timestamp || Date.now()),
                type: 'posted'
            };
            
            this.accounts[this.currentAccount].posts.push(post);
            this.savePosts();
            
            return result;
        } catch (error) {
            console.error('Error posting:', error);
            throw error;
        }
    }

    async schedulePost() {
        const content = document.getElementById('social-post-content').value.trim();
        const scheduleDate = document.getElementById('schedule-date').value;
        const scheduleTime = document.getElementById('schedule-time').value;
        
        if (!content) {
            this.showNotification('Please enter some content to schedule', 'error');
            return;
        }
        
        if (!scheduleDate || !scheduleTime) {
            this.showNotification('Please select a date and time for scheduling', 'error');
            return;
        }
        
        const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
        if (scheduledDateTime <= new Date()) {
            this.showNotification('Please select a future date and time', 'error');
            return;
        }
        
        try {
            const thread = this.createThread(content);
            
            // Call the API endpoint
            const response = await fetch('/api/social-media/schedule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    account: this.currentAccount,
                    content: thread,
                    scheduledFor: scheduledDateTime.toISOString()
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            const scheduledPost = {
                id: result.scheduleId || Date.now(),
                account: this.currentAccount,
                content: thread,
                scheduledFor: scheduledDateTime,
                created: new Date(),
                type: 'scheduled'
            };
            
            this.scheduledPosts.push(scheduledPost);
            this.saveScheduledPosts();
            this.updateScheduledPostsList();
            this.updateStats();
            
            // Clear the form
            document.getElementById('social-post-content').value = '';
            document.getElementById('schedule-date').value = '';
            document.getElementById('schedule-time').value = '';
            this.updateCharacterCount();
            
            this.showNotification(`Post scheduled for ${scheduledDateTime.toLocaleString()}`, 'success');
            
        } catch (error) {
            console.error('Error scheduling post:', error);
            this.showNotification('Failed to schedule post. Please try again.', 'error');
        }
    }

    saveDraft() {
        const content = document.getElementById('social-post-content').value.trim();
        if (!content) {
            this.showNotification('Please enter some content to save as draft', 'error');
            return;
        }
        
        const draft = {
            id: Date.now(),
            account: this.currentAccount,
            content: content,
            created: new Date(),
            type: 'draft'
        };
        
        this.drafts.push(draft);
        this.saveDrafts();
        this.updateStats();
        
        // Clear the form
        document.getElementById('social-post-content').value = '';
        this.updateCharacterCount();
        
        this.showNotification('Draft saved successfully!', 'success');
    }

    updateScheduledPostsList() {
        const listContainer = document.getElementById('scheduled-posts-list');
        if (!listContainer) return;
        
        const accountPosts = this.scheduledPosts.filter(post => post.account === this.currentAccount);
        
        if (accountPosts.length === 0) {
            listContainer.innerHTML = `
                <div class="text-center py-8 text-safe-muted">
                    <div class="text-2xl mb-2">📝</div>
                    <div>No scheduled posts yet</div>
                    <div class="text-sm mt-1">Posts you schedule will appear here</div>
                </div>
            `;
            return;
        }
        
        listContainer.innerHTML = accountPosts
            .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))
            .map(post => `
                <div class="bg-neon-black border border-neon-border rounded-lg p-4">
                    <div class="flex justify-between items-start mb-2">
                        <div class="text-sm text-neon-teal">
                            📅 ${new Date(post.scheduledFor).toLocaleString()}
                        </div>
                        <button onclick="socialMediaScheduler.deleteScheduledPost(${post.id})" class="text-neon-red hover:text-red-400 text-sm">
                            🗑️ Delete
                        </button>
                    </div>
                    <div class="text-neon-gray">
                        ${Array.isArray(post.content) 
                            ? `<strong>Thread (${post.content.length} posts):</strong><br>${post.content[0].substring(0, 100)}...`
                            : post.content.substring(0, 100) + (post.content.length > 100 ? '...' : '')
                        }
                    </div>
                </div>
            `).join('');
    }

    deleteScheduledPost(postId) {
        this.scheduledPosts = this.scheduledPosts.filter(post => post.id !== postId);
        this.saveScheduledPosts();
        this.updateScheduledPostsList();
        this.updateStats();
        this.showNotification('Scheduled post deleted', 'info');
    }

    updateStats() {
        const today = new Date().toDateString();
        const account = this.accounts[this.currentAccount];
        
        const postsToday = account.posts.filter(post => 
            new Date(post.timestamp).toDateString() === today
        ).length;
        
        const scheduledCount = this.scheduledPosts.filter(post => 
            post.account === this.currentAccount
        ).length;
        
        const draftsCount = this.drafts.filter(draft => 
            draft.account === this.currentAccount
        ).length;
        
        const totalPosts = account.posts.length;
        
        // Update UI
        const postsTodayEl = document.getElementById('posts-today');
        const scheduledCountEl = document.getElementById('scheduled-count');
        const draftsCountEl = document.getElementById('drafts-count');
        const totalPostsEl = document.getElementById('total-posts');
        
        if (postsTodayEl) postsTodayEl.textContent = postsToday;
        if (scheduledCountEl) scheduledCountEl.textContent = scheduledCount;
        if (draftsCountEl) draftsCountEl.textContent = draftsCount;
        if (totalPostsEl) totalPostsEl.textContent = totalPosts;
    }

    setDefaultDateTime() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0); // Default to 9 AM tomorrow
        
        const dateInput = document.getElementById('schedule-date');
        const timeInput = document.getElementById('schedule-time');
        
        if (dateInput) {
            dateInput.value = tomorrow.toISOString().split('T')[0];
        }
        
        if (timeInput) {
            timeInput.value = '09:00';
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg max-w-sm transition-all duration-300 ${
            type === 'success' ? 'bg-green-600 text-white' :
            type === 'error' ? 'bg-red-600 text-white' :
            type === 'info' ? 'bg-blue-600 text-white' :
            'bg-gray-600 text-white'
        }`;
        
        notification.innerHTML = `
            <div class="flex items-center justify-between">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                    ✕
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    // Local storage methods
    loadScheduledPosts() {
        try {
            return JSON.parse(localStorage.getItem('social_scheduled_posts') || '[]');
        } catch {
            return [];
        }
    }

    saveScheduledPosts() {
        localStorage.setItem('social_scheduled_posts', JSON.stringify(this.scheduledPosts));
    }

    loadDrafts() {
        try {
            return JSON.parse(localStorage.getItem('social_drafts') || '[]');
        } catch {
            return [];
        }
    }

    saveDrafts() {
        localStorage.setItem('social_drafts', JSON.stringify(this.drafts));
    }

    savePosts() {
        localStorage.setItem('social_accounts', JSON.stringify(this.accounts));
    }

    loadPosts() {
        try {
            const saved = JSON.parse(localStorage.getItem('social_accounts') || '{}');
            Object.keys(saved).forEach(key => {
                if (this.accounts[key]) {
                    this.accounts[key] = { ...this.accounts[key], ...saved[key] };
                }
            });
        } catch (error) {
            console.warn('Error loading posts:', error);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 Social Media JS: DOM loaded');
    
    // Only initialize if we're on the social media tab
    const socialTab = document.getElementById('social-media-tab');
    console.log('📱 Social Media JS: Found tab element:', socialTab);
    
    if (socialTab) {
        console.log('📱 Social Media JS: Initializing scheduler...');
        window.socialMediaScheduler = new SocialMediaScheduler();
        console.log('📱 Social Media JS: Scheduler initialized');
        
        // Update scheduled posts list when switching to social media tab
        const socialTabButton = document.querySelector('[data-tab="social-media"]');
        console.log('📱 Social Media JS: Found tab button:', socialTabButton);
        
        if (socialTabButton) {
            socialTabButton.addEventListener('click', () => {
                console.log('📱 Social Media JS: Tab clicked, updating content...');
                setTimeout(() => {
                    if (window.socialMediaScheduler) {
                        window.socialMediaScheduler.updateScheduledPostsList();
                        window.socialMediaScheduler.updateStats();
                        console.log('📱 Social Media JS: Content updated');
                    }
                }, 100);
            });
        }
    } else {
        console.warn('📱 Social Media JS: Tab element not found!');
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SocialMediaScheduler;
}
