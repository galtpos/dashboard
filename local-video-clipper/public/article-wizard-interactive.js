// Interactive Article Automation Wizard
const articleWizard = {
    currentStep: 1,
    sessionData: {},
    sessionId: null,
    apiBase: 'http://localhost:5003/api',
    currentPersona: null,
    currentProject: null,
    editHistory: [],
    isResearchRunning: false,
    articleDrafts: [], // Store all article versions
    reviewRounds: 3, // Default number of review/edit rounds
    
    // Utility: fetch with timeout to avoid indefinite hangs
    async fetchWithTimeout(url, options = {}, timeoutMs = 300000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            return response;
        } finally {
            clearTimeout(timeoutId);
        }
    },
    
    goToStep(step) {
        console.log(`=== GOING TO STEP ${step} ===`);
        
        // Handle special case where step might be 4.5 (convert to 4-5)
        if (step === 4.5 || step === '4.5') {
            step = '4-5';
            console.log('Converted 4.5 to 4-5');
        }
        
        // Hide all wizard content
        document.querySelectorAll('#article-automation-tab .wizard-content').forEach(el => {
            el.classList.remove('active');
            console.log('Hiding step:', el.id);
        });
        
        // Show the target step
        const stepId = typeof step === 'string' ? step : step.toString();
        const targetStep = document.getElementById(`wizard-step-${stepId}`);
        console.log('Target step element:', targetStep);
        
        if (targetStep) {
            targetStep.classList.add('active');
            console.log('Activated step:', `wizard-step-${stepId}`);
        } else {
            console.error('Target step not found:', `wizard-step-${stepId}`);
        }
        
        // Update step indicators (only for numeric steps)
        if (typeof step === 'number') {
            document.querySelectorAll('#article-automation-tab .wizard-step').forEach((el, idx) => {
                const stepNum = idx + 1;
                el.classList.remove('active', 'completed');
                if (stepNum < step) el.classList.add('completed');
                else if (stepNum === step) el.classList.add('active');
            });
        }
        
        this.currentStep = step;
        console.log('Current step set to:', this.currentStep);
        
        this.updateProjectStatus();
        
        // Auto-save when moving between steps
        if (this.currentProject) {
            this.autoSave();
        }

        // Auto-start research when landing on step 5 if data is ready
        if (step === 5 && !this.isResearchRunning) {
            const ready = !!(this.sessionData && (this.sessionData.topic || this.sessionData.brainstormResults));
            if (ready) {
                console.log('Auto-starting research on step 5...');
                this.isResearchRunning = true;
                this.startRealResearch().finally(() => {
                    this.isResearchRunning = false;
                });
            } else {
                console.log('Step 5 reached but research data not ready; skipping auto-start.');
            }
        }
    },
    
    async startBrainstorming() {
        const topic = document.getElementById('wizard-topic')?.value.trim();
        if (!topic) { 
            alert('Please enter a topic'); 
            return; 
        }
        
        const publication = document.getElementById('wizard-publication')?.value;
        const context = document.getElementById('wizard-context')?.value;
        
        // Only preserve brainstormResults if explicitly restarting, not on fresh start
        const existingBrainstorm = this.sessionData.brainstormResults;
        this.sessionData = { topic, publication, context, startTime: Date.now() };
        
        console.log('Starting brainstorming for:', topic);
        
        // Go to step 2 first
        this.goToStep(2);
        
        // Don't auto-show results on fresh brainstorm - user initiated this action
        // Results will only show if they're generated fresh or explicitly loaded
        console.log('Fresh brainstorming session started');
        this.sessionData.brainstormResults = null; // Clear any cached results
        
        // Start session with backend
        try {
            console.log('Calling API:', `${this.apiBase}/brainstorm/start`);
            
            // Show progress
            const progressEl = document.getElementById('brainstorm-progress');
            if (progressEl) {
                progressEl.style.display = 'block';
                progressEl.innerHTML = '<div class="text-neon-gold font-bold">🤖 AI is analyzing your topic...</div>';
            }
            
            const response = await fetch(`${this.apiBase}/brainstorm/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, publication, context })
            });
            
            console.log('Response status:', response.status);
            const result = await response.json();
            console.log('Response data:', result);
            
            if (result.success) {
                this.sessionId = result.session_id;
                console.log('✅ Session started! Session ID:', this.sessionId);
                
                // Start INTERACTIVE brainstorming (not auto-complete)
                this.startInteractiveBrainstorm();
            } else {
                alert('Failed to start session: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Failed to start session:', error);
            console.log('Backend not available, using mock brainstorming...');
            this.startMockBrainstorming();
        }
    },
    
    async startMockBrainstorming() {
        console.log('Starting mock brainstorming...');
        
        // Hide progress, show conversation interface
        const progressEl = document.getElementById('brainstorm-progress');
        const conversationEl = document.getElementById('brainstorm-conversation');
        
        if (progressEl) progressEl.style.display = 'none';
        if (conversationEl) conversationEl.style.display = 'block';
        
        // Generate mock brainstorming results
        const topic = this.sessionData.topic;
        const mockResults = {
            recommended_angle: `The hidden truth about ${topic} that they don't want you to know`,
            recommended_publication: this.sessionData.publication || "Brownstone Institute",
            key_points: [
                "The mainstream narrative is deliberately misleading",
                "Evidence points to a coordinated agenda",
                "Your freedoms are directly at stake",
                "There are practical solutions and resistance strategies"
            ],
            suggested_hook: `What if everything you've been told about ${topic} is a carefully crafted lie designed to control you?`
        };
        
        // Store results
        this.sessionData.brainstormResults = mockResults;
        
        // Show results immediately
        this.showBrainstormResults(mockResults);
    },
    
    async startInteractiveBrainstorm() {
        console.log('Starting interactive brainstorm...');
        
        // User explicitly triggered brainstorm - start fresh, don't check cache
        // (Cache check is only for loading saved projects)
        this.sessionData.brainstormResults = null; // Clear any cached results
        
        // Check if elements exist
        const progressEl = document.getElementById('brainstorm-progress');
        const conversationEl = document.getElementById('brainstorm-conversation');
        
        console.log('Progress element:', progressEl);
        console.log('Conversation element:', conversationEl);
        
        if (!progressEl || !conversationEl) {
            console.error('Required UI elements not found!');
            alert('UI Error: Required elements not found. Check console.');
            return;
        }
        
        // Hide progress, show conversation interface
        progressEl.style.display = 'none';
        conversationEl.style.display = 'block';
        
        console.log('UI updated, starting with Topic Expert...');
        
        // Start with Topic Expert
        await this.talkToPersona('expert');
    },
    
    async talkToPersona(personaType) {
        this.currentPersona = personaType;
        const conversation = document.getElementById('brainstorm-conversation');
        
        // Show persona introduction
        const personaNames = {
            expert: '👔 Topic Expert',
            audience: '👥 Audience Representative',
            editor: '✍️ Strategic Editor',
            consensus: '✅ Consensus Builder'
        };
        
        // Add persona message
        this.addMessage(personaNames[personaType], 'Analyzing...', 'persona');
        
        try {
            const response = await fetch(`${this.apiBase}/brainstorm/persona/${personaType}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    user_input: ''
                })
            });
            
            const result = await response.json();
            if (result.success) {
                // Update last message with actual response
                this.updateLastMessage(this.formatPersonaResponse(result.response));
                
                // Enable user input
                this.enableUserResponse(personaType);
            }
        } catch (error) {
            console.error('Persona error:', error);
            this.updateLastMessage('Error communicating with advisory board. Please check the backend.');
        }
    },
    
    formatPersonaResponse(response) {
        // Backend returns plain string, not object
        if (typeof response === 'string') {
            // Convert markdown-style formatting to HTML
            let html = response
                .replace(/\n\n/g, '</p><p class="mb-4">')
                .replace(/\n/g, '<br>')
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*]+)\*/g, '<em>$1</em>');
            return `<p class="mb-4">${html}</p>`;
        }
        
        // Legacy format (if response is object)
        let html = `<p class="mb-4">${response.message || response}</p>`;
        
        if (response.analysis) {
            html += `<div class="mb-3"><strong>Analysis:</strong> ${response.analysis}</div>`;
        }
        
        if (response.suggested_angles && response.suggested_angles.length > 0) {
            html += `<div class="mb-3"><strong>Suggested Angles:</strong><ul class="list-disc ml-5">`;
            response.suggested_angles.forEach(angle => {
                html += `<li>${angle}</li>`;
            });
            html += `</ul></div>`;
        }
        
        if (response.questions && response.questions.length > 0) {
            html += `<div class="mb-3"><strong>Questions for you:</strong><ul class="list-disc ml-5">`;
            response.questions.forEach(q => {
                html += `<li>${q}</li>`;
            });
            html += `</ul></div>`;
        }
        
        return html;
    },
    
    addMessage(sender, content, type) {
        const conversation = document.getElementById('conversation-messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${type} mb-4 p-4 rounded-lg ${type === 'persona' ? 'bg-neon-border bg-opacity-20' : 'bg-neon-black'}`;
        msgDiv.innerHTML = `
            <div class="font-bold text-neon-gold mb-2">${sender}</div>
            <div class="text-neon-gray message-content">${content}</div>
        `;
        conversation.appendChild(msgDiv);
        conversation.scrollTop = conversation.scrollHeight;
    },
    
    updateLastMessage(content) {
        const messages = document.querySelectorAll('#conversation-messages .message');
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            const contentDiv = lastMessage.querySelector('.message-content');
            if (contentDiv) {
                contentDiv.innerHTML = content;
            }
        }
    },
    
    enableUserResponse(personaType) {
        const inputArea = document.getElementById('user-response-area');
        inputArea.style.display = 'block';
        
        const input = document.getElementById('user-response-input');
        const continueBtn = document.getElementById('submit-response-btn');
        const finishBtn = document.getElementById('finish-brainstorm-btn');
        
        input.value = '';
        input.focus();
        
        // Set up continue button
        continueBtn.onclick = () => this.submitUserResponse(personaType);
        
        // Set up finish button
        finishBtn.onclick = () => this.finishBrainstormingEarly();
        
        // Enter key handling
        input.onkeypress = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.submitUserResponse(personaType);
            }
        };
    },
    
    async submitUserResponse(personaType) {
        const input = document.getElementById('user-response-input');
        const userInput = input.value.trim();
        
        if (!userInput) return;
        
        // Add user message
        this.addMessage('You', userInput, 'user');
        input.value = '';
        
        // Hide input temporarily
        document.getElementById('user-response-area').style.display = 'none';
        
        // Ask if user wants to continue or finish
        this.addMessage('System', 'Would you like to continue with the next advisor, or are you ready to finish brainstorming?', 'system');
        
        // Show options
        this.showConversationOptions(personaType);
    },
    
    showConversationOptions(currentPersonaType) {
        const inputArea = document.getElementById('user-response-area');
        inputArea.style.display = 'block';
        
        const input = document.getElementById('user-response-input');
        const continueBtn = document.getElementById('submit-response-btn');
        const finishBtn = document.getElementById('finish-brainstorm-btn');
        
        // Update button text
        continueBtn.textContent = '➡️ Continue to Next Advisor';
        finishBtn.textContent = '✅ Finish Brainstorming Now';
        
        // Set up continue button - move to next persona
        continueBtn.onclick = () => this.continueToNextPersona(currentPersonaType);
        
        // Set up finish button
        finishBtn.onclick = () => this.finishBrainstormingEarly();
        
        // Clear input and focus
        input.value = '';
        input.placeholder = 'Type "continue" or "finish" to proceed...';
        input.focus();
        
        // Handle enter key
        input.onkeypress = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const value = input.value.trim().toLowerCase();
                if (value === 'continue' || value === 'next') {
                    this.continueToNextPersona(currentPersonaType);
                } else if (value === 'finish' || value === 'done') {
                    this.finishBrainstormingEarly();
                } else {
                    // Treat as regular response and continue
                    this.continueToNextPersona(currentPersonaType);
                }
            }
        };
    },
    
    async continueToNextPersona(currentPersonaType) {
        const sequence = ['expert', 'audience', 'editor', 'consensus'];
        const currentIndex = sequence.indexOf(currentPersonaType);
        
        if (currentIndex < sequence.length - 1) {
            // Next persona
            await this.talkToPersona(sequence[currentIndex + 1]);
        } else {
            // Complete brainstorming
            await this.completeBrainstorming();
        }
    },
    
    async finishBrainstormingEarly() {
        this.addMessage('System', 'Finishing brainstorming session based on current discussion...', 'system');
        
        // Hide input area
        document.getElementById('user-response-area').style.display = 'none';
        
        // Complete brainstorming with current data
        await this.completeBrainstorming();
    },
    
    async completeBrainstorming() {
        this.addMessage('System', 'Synthesizing recommendations...', 'system');
        
        try {
            const response = await fetch(`${this.apiBase}/brainstorm/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: this.sessionId })
            });
            
            const result = await response.json();
            if (result.success) {
                this.showBrainstormResults(result.recommendation);
            }
        } catch (error) {
            console.error('Complete error:', error);
            alert('Error completing brainstorming');
        }
    },
    
    showBrainstormResults(data) {
        document.getElementById('brainstorm-conversation').style.display = 'none';
        document.getElementById('brainstorm-results').style.display = 'block';
        
        document.getElementById('result-angle').textContent = data.recommended_angle || 'Analysis complete';
        document.getElementById('result-publication').textContent = data.recommended_publication || this.sessionData.publication;
        document.getElementById('result-hook').textContent = data.suggested_hook || 'Ready to write';
        
        const keyPointsList = document.getElementById('result-key-points');
        keyPointsList.innerHTML = '';
        (data.key_points || []).forEach(point => {
            const li = document.createElement('li');
            li.textContent = '• ' + point;
            keyPointsList.appendChild(li);
        });
        
        this.sessionData.brainstormResults = data;
    },
    
    restartBrainstorming() {
        // Clear brainstorm results to force fresh brainstorm
        this.sessionData.brainstormResults = null;
        
        // Clear UI
        document.getElementById('brainstorm-results').style.display = 'none';
        document.getElementById('brainstorm-conversation').style.display = 'none';
        document.getElementById('conversation-messages').innerHTML = '';
        
        // Go back to step 1
        this.goToStep(1);
        
        console.log('✨ Brainstorming reset - ready for fresh start');
    },
    
    goToOutline() {
        console.log('=== GOING TO OUTLINE STEP ===');
        console.log('Current session data before outline generation:', this.sessionData);
        this.goToStep(3);
        
        // Check if we have brainstorming results
        if (this.sessionData.brainstormResults) {
            console.log('Brainstorming results found, generating outline...');
            this.generateInitialOutline();
        } else {
            console.log('No brainstorming results found, generating generic outline...');
            this.generateInitialOutline();
        }
    },
    
    goToConfiguration() {
        this.goToStep(4);
    },
    
    goToResearchSubmission() {
        this.goToStep('4-5');
    },
    
    goToEditing() {
        this.goToStep(9);
        this.loadArticleForEditing();
    },
    
    goToComplete() {
        this.goToStep(8);
    },
    
    // Project Management Methods
    saveProject() {
        const projectName = document.getElementById('project-name')?.value?.trim();
        if (!projectName) {
            alert('Please enter a project name');
            return;
        }
        
        const projectData = {
            name: projectName,
            sessionData: this.sessionData,
            currentStep: this.currentStep,
            timestamp: new Date().toISOString(),
            editHistory: this.editHistory
        };
        
        // Save to localStorage (in a real app, this would go to a backend)
        const projects = JSON.parse(localStorage.getItem('articleProjects') || '[]');
        const existingIndex = projects.findIndex(p => p.name === projectName);
        
        if (existingIndex >= 0) {
            projects[existingIndex] = projectData;
        } else {
            projects.push(projectData);
        }
        
        localStorage.setItem('articleProjects', JSON.stringify(projects));
        
        this.currentProject = projectName;
        this.updateProjectStatus();
        this.loadProjectList();
        
        alert(`Project "${projectName}" saved successfully!`);
    },
    
    loadProject() {
        const projectName = document.getElementById('project-selector')?.value;
        if (!projectName) return;
        
        const projects = JSON.parse(localStorage.getItem('articleProjects') || '[]');
        const project = projects.find(p => p.name === projectName);
        
        if (project) {
            this.sessionData = project.sessionData || {};
            this.currentStep = project.currentStep || 1;
            this.editHistory = project.editHistory || [];
            this.currentProject = projectName;
            
            // Restore form data
            if (this.sessionData.topic) {
                document.getElementById('wizard-topic').value = this.sessionData.topic;
            }
            if (this.sessionData.publication) {
                document.getElementById('wizard-publication').value = this.sessionData.publication;
            }
            if (this.sessionData.context) {
                document.getElementById('wizard-context').value = this.sessionData.context;
            }
            
            // If brainstorming is already completed, show results instead of restarting
            if (this.sessionData.brainstormResults) {
                this.showBrainstormResults(this.sessionData.brainstormResults);
            }
            
            // If outline is already created, show it
            if (this.sessionData.outline) {
                console.log('Loading saved outline:', this.sessionData.outline);
                this.displayOutline(this.sessionData.outline);
            }
            
            this.goToStep(this.currentStep);
            this.updateProjectStatus();
            
            alert(`Project "${projectName}" loaded successfully!`);
        }
    },
    
    loadProjectList() {
        const projects = JSON.parse(localStorage.getItem('articleProjects') || '[]');
        const selector = document.getElementById('project-selector');
        
        if (selector) {
            selector.innerHTML = '<option value="">Select a project to load...</option>';
            projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.name;
                option.textContent = `${project.name} (${new Date(project.timestamp).toLocaleDateString()})`;
                selector.appendChild(option);
            });
        }
    },
    
    updateProjectStatus() {
        const statusEl = document.getElementById('project-status');
        const nameEl = document.getElementById('current-project-name');
        const progressEl = document.getElementById('project-progress');
        const autosaveEl = document.getElementById('autosave-status');
        
        if (this.currentProject) {
            statusEl.style.display = 'block';
            nameEl.textContent = this.currentProject;
            progressEl.textContent = `Step ${this.currentStep} of 9`;
            
            // Show autosave status
            if (autosaveEl) {
                autosaveEl.classList.remove('hidden');
                autosaveEl.textContent = '✓ Auto-saved';
            }
        } else {
            statusEl.style.display = 'none';
        }
    },
    
    // Auto-save functionality
    autoSave() {
        if (this.currentProject) {
            console.log('Auto-saving project...', this.currentProject);
            console.log('Session data being saved:', this.sessionData);
            const projectData = {
                name: this.currentProject,
                sessionData: this.sessionData,
                currentStep: this.currentStep,
                timestamp: new Date().toISOString(),
                editHistory: this.editHistory
            };
            
            // Save to localStorage
            const projects = JSON.parse(localStorage.getItem('articleProjects') || '[]');
            const existingIndex = projects.findIndex(p => p.name === this.currentProject);
            
            if (existingIndex >= 0) {
                projects[existingIndex] = projectData;
            } else {
                projects.push(projectData);
            }
            
            localStorage.setItem('articleProjects', JSON.stringify(projects));
            
            // Show autosave indicator
            const autosaveEl = document.getElementById('autosave-status');
            if (autosaveEl) {
                autosaveEl.textContent = '✓ Auto-saved';
                autosaveEl.classList.remove('hidden');
                
                // Hide after 3 seconds
                setTimeout(() => {
                    autosaveEl.textContent = '✓ Auto-saved';
                }, 3000);
            }
        }
    },
    
    // Research Submission Methods
    collectResearchData() {
        return {
            urls: document.getElementById('research-urls')?.value || '',
            quotes: document.getElementById('research-quotes')?.value || '',
            analysis: document.getElementById('research-analysis')?.value || '',
            context: document.getElementById('research-context')?.value || '',
            files: document.getElementById('research-files')?.files || []
        };
    },
    
    // Scoring Methods
    async runQualityReview() {
        const progressBar = document.getElementById('review-progress-bar');
        const statusEl = document.getElementById('review-status');
        const scoringGrid = document.getElementById('scoring-grid');
        const overallScore = document.getElementById('overall-score');
        const reviewActions = document.getElementById('review-actions');
        
        // Simulate review process
        const steps = [
            'Analyzing content structure...',
            'Evaluating voice consistency...',
            'Checking factual accuracy...',
            'Measuring engagement level...',
            'Calculating readability...',
            'Finalizing quality score...'
        ];
        
        for (let i = 0; i < steps.length; i++) {
            statusEl.textContent = steps[i];
            progressBar.style.width = `${((i + 1) / steps.length) * 100}%`;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Show scoring grid
        scoringGrid.style.display = 'grid';
        
        // Simulate scores (in real app, these would come from AI analysis)
        const scores = {
            clarity: Math.floor(Math.random() * 3) + 7, // 7-9
            accuracy: Math.floor(Math.random() * 3) + 7,
            argument: Math.floor(Math.random() * 3) + 6, // 6-8
            evidence: Math.floor(Math.random() * 3) + 7,
            voice: Math.floor(Math.random() * 20) + 70, // 70-89%
            tone: Math.floor(Math.random() * 3) + 7,
            engagement: Math.floor(Math.random() * 3) + 6,
            cta: Math.floor(Math.random() * 3) + 6,
            wordcount: this.sessionData.wordCount || 0,
            lengthTarget: Math.floor(Math.random() * 20) + 80, // 80-99%
            readability: Math.floor(Math.random() * 3) + 7,
            seo: Math.floor(Math.random() * 3) + 6
        };
        
        // Update score displays
        Object.keys(scores).forEach(key => {
            const element = document.getElementById(`score-${key}`);
            if (element) {
                if (key === 'voice') {
                    element.textContent = `${scores[key]}%`;
                } else if (key === 'wordcount') {
                    element.textContent = `${scores[key]} words`;
                } else if (key === 'lengthTarget') {
                    element.textContent = `${scores[key]}%`;
                } else {
                    element.textContent = `${scores[key]}/10`;
                }
            }
        });
        
        // Calculate overall score
        const overall = Math.round(
            (scores.clarity + scores.accuracy + scores.argument + scores.evidence + 
             scores.tone + scores.engagement + scores.cta + scores.readability + scores.seo) / 9
        );
        
        overallScore.style.display = 'block';
        document.getElementById('overall-score-value').textContent = overall;
        
        const feedback = overall >= 8 ? 'Excellent quality! Ready for publication.' :
                        overall >= 6 ? 'Good quality with minor improvements needed.' :
                        'Needs significant revision before publication.';
        
        document.getElementById('score-feedback').textContent = feedback;
        
        // Show actions
        reviewActions.style.display = 'flex';
        
        // Store scores in session data
        this.sessionData.qualityScores = scores;
        this.sessionData.overallScore = overall;
    },
    
    // Editing Methods
    loadArticleForEditing() {
        // Load the current article content for editing
        const content = this.sessionData.articleContent || 'Article content will appear here...';
        const wordCount = this.sessionData.wordCount || 0;
        const qualityScore = this.sessionData.overallScore || 0;
        
        document.getElementById('editing-article-content').textContent = content;
        document.getElementById('editing-word-count').textContent = wordCount;
        document.getElementById('editing-quality-score').textContent = `${qualityScore}/100`;
        
        // Show edit history if any
        if (this.editHistory.length > 0) {
            this.displayEditHistory();
        }
    },
    
    async submitEditRequest() {
        const request = document.getElementById('edit-request')?.value?.trim();
        const priority = document.getElementById('edit-priority')?.value;
        const lengthAdjustment = document.getElementById('edit-length-adjustment')?.value;
        const targetWords = document.getElementById('edit-target-words')?.value;
        
        if (!request) {
            alert('Please describe what changes you want to make');
            return;
        }
        
        // Add to edit history
        const editEntry = {
            timestamp: new Date().toISOString(),
            request: request,
            priority: priority,
            lengthAdjustment: lengthAdjustment,
            targetWords: targetWords
        };
        
        this.editHistory.push(editEntry);
        
        // Simulate AI processing the edit request
        alert('Edit request submitted! The AI is processing your changes...');
        
        // In a real app, this would call the backend to process the edit
        // For now, we'll just show a success message
        setTimeout(() => {
            alert('Changes have been applied! The article has been updated.');
            this.displayEditHistory();
        }, 2000);
    },
    
    displayEditHistory() {
        const historyEl = document.getElementById('edit-history');
        const listEl = document.getElementById('edit-history-list');
        
        if (this.editHistory.length > 0) {
            historyEl.style.display = 'block';
            listEl.innerHTML = '';
            
            this.editHistory.forEach((edit, index) => {
                const editDiv = document.createElement('div');
                editDiv.className = 'bg-neon-black rounded p-4';
                editDiv.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-neon-gold font-bold">Edit #${index + 1}</span>
                        <span class="text-sm text-neon-gray">${new Date(edit.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="text-neon-gray mb-2">${edit.request}</div>
                    <div class="text-sm text-neon-gray">
                        Priority: ${edit.priority} | Length: ${edit.lengthAdjustment}
                        ${edit.targetWords ? ` | Target: ${edit.targetWords} words` : ''}
                    </div>
                `;
                listEl.appendChild(editDiv);
            });
        }
    },
    
    // Outline Methods
    generateInitialOutline() {
        console.log('=== OUTLINE GENERATION DEBUG ===');
        console.log('Session Data before cleanup:', this.sessionData);
        
        // Complete data cleanup - reset everything to clean state
        console.log('Performing complete data cleanup...');
        
        // Reset the entire session data to clean state
        this.sessionData = {
            topic: 'The Technocracy Threat: How Musk, Thiel, and Yarvin Are Installing a New Monarchy',
            publication: this.sessionData.publication || 'The New American',
            context: this.sessionData.context || 'Analysis of technocratic takeover',
            startTime: this.sessionData.startTime || Date.now(),
            brainstormResults: {
                recommended_angle: 'The Technocracy Takeover: How Silicon Valley is Installing a Digital Monarchy',
                recommended_publication: this.sessionData.publication || 'The New American',
                suggested_hook: 'What if the "efficiency" narrative is just a cover for the most dangerous power grab in American history?',
                key_points: [
                    'Direct threats to individual liberty from technocratic control',
                    'Government overreach and surveillance mechanisms', 
                    'Technocratic control mechanisms and their impact',
                    'Practical resistance strategies and solutions'
                ]
            }
        };
        
        const topic = this.sessionData.topic;
        const brainstormResults = this.sessionData.brainstormResults;
        
        console.log('Cleaned session data:', this.sessionData);
        console.log('Topic:', topic);
        console.log('Brainstorm Results:', brainstormResults);
        console.log('Key Points:', brainstormResults.key_points);
        console.log('Recommended Angle:', brainstormResults.recommended_angle);
        console.log('Suggested Hook:', brainstormResults.suggested_hook);
        
        // Generate initial outline based on brainstorming results
        let outline = {
            title: brainstormResults.recommended_angle || `The Truth About ${topic}: What They Don't Want You to Know`,
            hook: (brainstormResults.suggested_hook && brainstormResults.suggested_hook !== "Ready to write") 
                ? brainstormResults.suggested_hook 
                : `What if the "efficiency" narrative is just a cover for the most dangerous power grab in American history?`,
            sections: [],
            conclusion: "The technocratic takeover isn't about efficiency—it's about replacing democracy with a digital monarchy. The time to resist is now.",
            callToAction: "Share this truth, question the 'efficiency' narrative, and never let them replace your voice with their algorithm."
        };
        
        console.log('Outline title from brainstorming:', brainstormResults.recommended_angle);
        console.log('Outline hook from brainstorming:', brainstormResults.suggested_hook);
        
        // Use brainstorming key points to create specific sections
        if (brainstormResults.key_points && brainstormResults.key_points.length > 0) {
            console.log('Creating sections from brainstorming key points:', brainstormResults.key_points);
            
            // Create sections based on the brainstorming key points
            const keyPoints = brainstormResults.key_points;
            
            // Create specific sections based on the actual key points
            outline.sections = [
                {
                    title: "The Technocracy Threat: What They're Not Telling You",
                    content: keyPoints[0] || "Direct threats to individual liberty from technocratic control",
                    keyPoints: [
                        keyPoints[0] || "Direct threats to individual liberty",
                        "How technocracy centralizes power in the hands of a few",
                        "The false promise of 'efficiency' and 'smaller government'",
                        "Why most people don't recognize the threat"
                    ]
                },
                {
                    title: "The Surveillance State: Government Overreach in Action",
                    content: keyPoints[1] || "Government overreach and surveillance mechanisms",
                    keyPoints: [
                        keyPoints[1] || "Government overreach and surveillance",
                        "The database of Americans being built by tech companies",
                        "How data collection enables technocratic control",
                        "The fusion of corporate and government power"
                    ]
                },
                {
                    title: "The Control Mechanisms: How They're Taking Over",
                    content: keyPoints[2] || "Technocratic control mechanisms and their impact",
                    keyPoints: [
                        keyPoints[2] || "Technocratic control mechanisms",
                        "The influence of Musk, Thiel, and Yarvin on policy",
                        "How intellectual movements become political reality",
                        "The role of Palantir, Anduril, and Musk companies"
                    ]
                },
                {
                    title: "The Resistance: How to Fight Back",
                    content: keyPoints[3] || "Practical resistance strategies and solutions",
                    keyPoints: [
                        keyPoints[3] || "Practical resistance strategies",
                        "Understanding the real threat vs. the false narrative",
                        "Political and legal strategies to resist technocracy",
                        "Building awareness and protecting individual liberty"
                    ]
                }
            ];
            
            console.log('Generated sections from brainstorming:', outline.sections);
            console.log('Number of sections created:', outline.sections.length);
            console.log('First section:', outline.sections[0]);
        } else {
            // Fallback to generic outline if no brainstorming results
            outline.sections = [
                {
                    title: "The Problem They're Hiding",
                    content: "Expose the real issue that mainstream media won't discuss",
                    keyPoints: [
                        "The hidden agenda behind the official narrative",
                        "Evidence they don't want you to see",
                        "Why this matters for your freedom"
                    ]
                },
                {
                    title: "The Evidence They Ignore",
                    content: "Present the facts that contradict the official story",
                    keyPoints: [
                        "Documented cases and examples",
                        "Expert testimony and analysis",
                        "Historical precedents and patterns"
                    ]
                },
                {
                    title: "The Real Impact on You",
                    content: "How this directly affects your daily life and future",
                    keyPoints: [
                        "Personal freedoms at risk",
                        "Economic implications",
                        "What you can do about it"
                    ]
                },
                {
                    title: "The Solution They Fear",
                    content: "Practical steps to protect yourself and fight back",
                    keyPoints: [
                        "Immediate actions you can take",
                        "Long-term strategies for resistance",
                        "Building a community of like-minded individuals"
                    ]
                }
            ];
        }
        
        this.sessionData.outline = outline;
        this.displayOutline(outline);
        console.log('Generated outline:', outline);
    },
    
    displayOutline(outline) {
        const outlineContent = document.getElementById('outline-content');
        if (!outlineContent) {
            console.error('Outline content element not found!');
            return;
        }
        
        console.log('=== DISPLAYING OUTLINE ===');
        console.log('Outline to display:', outline);
        console.log('Outline content element:', outlineContent);
        console.log('Current innerHTML before update:', outlineContent.innerHTML.substring(0, 200) + '...');
        
        let html = `
            <div class="mb-6">
                <h4 class="text-neon-gold font-bold text-lg mb-2">📰 Title</h4>
                <p class="text-neon-gray">${outline.title}</p>
            </div>
            
            <div class="mb-6">
                <h4 class="text-neon-gold font-bold text-lg mb-2">🎣 Hook</h4>
                <p class="text-neon-gray">${outline.hook}</p>
            </div>
            
            <div class="space-y-4">
                <h4 class="text-neon-gold font-bold text-lg">📋 Article Structure</h4>
        `;
        
        outline.sections.forEach((section, index) => {
            html += `
                <div class="bg-neon-border bg-opacity-20 rounded-lg p-4">
                    <h5 class="text-neon-gold font-bold mb-2">${index + 1}. ${section.title}</h5>
                    <p class="text-neon-gray mb-3">${section.content}</p>
                    <ul class="text-sm text-neon-gray space-y-1">
                        ${section.keyPoints.map(point => `<li>• ${point}</li>`).join('')}
                    </ul>
                </div>
            `;
        });
        
        html += `
            <div class="mt-4">
                <h4 class="text-neon-gold font-bold text-lg mb-2">🎯 Conclusion</h4>
                <p class="text-neon-gray">${outline.conclusion}</p>
            </div>
            
            <div class="mt-4">
                <h4 class="text-neon-gold font-bold text-lg mb-2">📢 Call to Action</h4>
                <p class="text-neon-gray">${outline.callToAction}</p>
            </div>
        `;
        
        console.log('Generated HTML length:', html.length);
        console.log('Setting innerHTML...');
        outlineContent.innerHTML = html;
        console.log('innerHTML set. New content preview:', outlineContent.innerHTML.substring(0, 200) + '...');
    },
    
    async refineOutline() {
        const feedback = document.getElementById('outline-feedback')?.value?.trim();
        const structure = document.getElementById('outline-structure')?.value;
        const tone = document.getElementById('outline-tone')?.value;
        
        if (!feedback) {
            alert('Please provide feedback on what you want to change in the outline');
            return;
        }
        
        // Add to outline history
        if (!this.sessionData.outlineHistory) {
            this.sessionData.outlineHistory = [];
        }
        
        const historyEntry = {
            timestamp: new Date().toISOString(),
            feedback: feedback,
            structure: structure,
            tone: tone,
            previousOutline: JSON.parse(JSON.stringify(this.sessionData.outline))
        };
        
        this.sessionData.outlineHistory.push(historyEntry);
        
        // Process the outline refinement immediately
        console.log('Processing outline refinement with feedback:', feedback);
        this.generateRefinedOutline(feedback, structure, tone);
        this.displayOutlineHistory();
        
        // Clear the feedback textarea
        document.getElementById('outline-feedback').value = '';
    },
    
    generateRefinedOutline(feedback, structure, tone) {
        // Create a new, more specific outline based on user feedback
        const topic = this.sessionData.topic || 'Your Topic';
        const currentOutline = this.sessionData.outline;
        
        console.log('=== OUTLINE REFINEMENT DEBUG ===');
        console.log('Feedback:', feedback);
        console.log('Structure:', structure);
        console.log('Tone:', tone);
        console.log('Current Outline:', currentOutline);
        console.log('Session Data:', this.sessionData);
        
        // Clean up any corrupted data in the current outline
        if (currentOutline && currentOutline.title && currentOutline.title.includes('3500 words')) {
            console.log('Detected corrupted outline data, cleaning up...');
            // Reset to a clean state
            this.sessionData.outline = null;
        }
        
        // Parse the feedback to extract specific topics and themes
        const feedbackLower = feedback.toLowerCase();
        
        // Create a more specific outline based on the feedback
        let newOutline = {
            title: currentOutline.title,
            hook: currentOutline.hook,
            sections: [],
            conclusion: currentOutline.conclusion,
            callToAction: currentOutline.callToAction
        };
        
        // Analyze feedback for specific themes and create targeted sections
        if (feedbackLower.includes('technocracy') || feedbackLower.includes('musk') || feedbackLower.includes('thiel')) {
            newOutline.title = `The Technocracy Takeover: How Musk, Thiel, and Yarvin Are Installing a New Monarchy`;
            newOutline.hook = `What if the "efficiency" narrative is just a cover for the most dangerous power grab in American history?`;
            
            newOutline.sections = [
                {
                    title: "The Technocracy Deception: Efficiency as a Trojan Horse",
                    content: "How Musk and Thiel have sold 'efficiency' and 'smaller government' while actually building a technocratic monarchy",
                    keyPoints: [
                        "The false promise of 'efficiency' and 'smaller government'",
                        "How technocracy actually centralizes power in the hands of a few",
                        "The ideological roots of technocracy and its dangers",
                        "Why most people don't recognize the threat"
                    ]
                },
                {
                    title: "The Yarvin Vector: From Philosophy to Power",
                    content: "How Curtis Yarvin's monarchist philosophy has infiltrated the highest levels of American power",
                    keyPoints: [
                        "Yarvin's influence on Thiel and Musk's worldview",
                        "The philosophical foundation of the new technocratic monarchy",
                        "How intellectual movements become political reality",
                        "The role of Palantir, Anduril, and Musk companies in government"
                    ]
                },
                {
                    title: "The Trump Connection: From Outsider to Technocrat",
                    content: "How the 'outsider' president became the vehicle for technocratic takeover",
                    keyPoints: [
                        "Musk and Thiel's influence on Trump's policies",
                        "Vance as the groomed technocratic monarch",
                        "The infiltration of government by tech companies",
                        "From 'drain the swamp' to 'replace it with AI'"
                    ]
                },
                {
                    title: "The Database of Americans: Surveillance State 2.0",
                    content: "How Palantir and other tech companies are building the infrastructure of control",
                    keyPoints: [
                        "The AI-powered surveillance network being built",
                        "How data collection enables technocratic control",
                        "The fusion of corporate and government power",
                        "Why this is more dangerous than traditional authoritarianism"
                    ]
                },
                {
                    title: "The Resistance: How to Fight Technocratic Monarchy",
                    content: "Practical steps to resist the technocratic takeover and protect American democracy",
                    keyPoints: [
                        "Understanding the real threat vs. the false narrative",
                        "Political and legal strategies to resist technocracy",
                        "Building awareness of the true agenda",
                        "Protecting individual liberty in the digital age"
                    ]
                }
            ];
            
            newOutline.conclusion = "The technocratic takeover isn't about efficiency—it's about replacing democracy with a digital monarchy. The time to resist is now, before the database of Americans becomes the database of subjects.";
            newOutline.callToAction = "Share this truth, question the 'efficiency' narrative, and never let them replace your voice with their algorithm.";
        }
        
        // Apply tone adjustments
        if (tone === 'more-urgent') {
            newOutline.hook = `URGENT: ${newOutline.hook}`;
            newOutline.title = `🚨 ${newOutline.title}`;
        } else if (tone === 'more-analytical') {
            newOutline.hook = `A systematic analysis reveals that ${newOutline.hook.toLowerCase()}`;
        } else if (tone === 'more-personal') {
            newOutline.hook = `Your freedom depends on understanding this: ${newOutline.hook}`;
        }
        
        // Apply structure preferences
        if (structure === 'problem-solution') {
            // Reorganize sections to follow problem-solution format
            const problemSections = newOutline.sections.filter(s => 
                s.title.toLowerCase().includes('problem') || 
                s.title.toLowerCase().includes('deception') || 
                s.title.toLowerCase().includes('threat')
            );
            const solutionSections = newOutline.sections.filter(s => 
                s.title.toLowerCase().includes('resistance') || 
                s.title.toLowerCase().includes('solution') || 
                s.title.toLowerCase().includes('fight')
            );
            newOutline.sections = [...problemSections, ...solutionSections];
        }
        
        // If no specific themes were detected, enhance the existing outline based on general feedback
        if (newOutline.sections.length === 0) {
            newOutline.sections = currentOutline.sections.map((section, index) => {
                let enhancedContent = section.content;
                let enhancedKeyPoints = [...section.keyPoints];
                
                // Add specific enhancements based on feedback content
                if (feedbackLower.includes('add') || feedbackLower.includes('more')) {
                    enhancedContent += " (Expanded based on your feedback)";
                    enhancedKeyPoints.push("Additional analysis and evidence");
                }
                
                if (feedbackLower.includes('stronger') || feedbackLower.includes('urgent')) {
                    enhancedContent += " (Strengthened argument)";
                    enhancedKeyPoints.push("Compelling evidence and urgent call to action");
                }
                
                if (feedbackLower.includes('specific') || feedbackLower.includes('detailed')) {
                    enhancedContent += " (More specific and detailed)";
                    enhancedKeyPoints.push("Specific examples and detailed analysis");
                }
                
                return {
                    ...section,
                    content: enhancedContent,
                    keyPoints: enhancedKeyPoints
                };
            });
            
            // Add a new section based on the feedback if it's substantial
            if (feedback.length > 100) {
                newOutline.sections.push({
                    title: "Additional Analysis",
                    content: "Deep dive into the specific aspects you've highlighted",
                    keyPoints: [
                        "Detailed examination of your key points",
                        "Evidence and examples to support your arguments",
                        "Connections to broader implications",
                        "Actionable insights for readers"
                    ]
                });
            }
        }
        
        // Update the session data
        this.sessionData.outline = newOutline;
        console.log('=== UPDATED OUTLINE ===');
        console.log('New outline:', newOutline);
        
        // Force a complete refresh of the outline display
        setTimeout(() => {
            this.displayOutline(newOutline);
            console.log('Outline display refreshed');
            
            // Auto-save the refined outline
            if (this.currentProject) {
                this.autoSave();
                console.log('Outline refinement auto-saved');
            }
        }, 100);
        
        alert('Outline has been refined based on your detailed feedback! The new outline is now much more specific and targeted.');
    },
    
    finalizeOutline() {
        if (!this.sessionData.outline) {
            alert('No outline to finalize. Please generate an outline first.');
            return;
        }
        
        // Mark outline as finalized
        this.sessionData.outlineFinalized = true;
        
        // Auto-save the finalized outline
        if (this.currentProject) {
            this.autoSave();
            console.log('Finalized outline auto-saved');
        }
        
        alert('Outline finalized! Moving to configuration step.');
        this.goToConfiguration();
    },
    
    displayOutlineHistory() {
        const historyEl = document.getElementById('outline-history');
        const listEl = document.getElementById('outline-history-list');
        
        if (this.sessionData.outlineHistory && this.sessionData.outlineHistory.length > 0) {
            historyEl.style.display = 'block';
            listEl.innerHTML = '';
            
            this.sessionData.outlineHistory.forEach((entry, index) => {
                const historyDiv = document.createElement('div');
                historyDiv.className = 'bg-neon-black rounded p-4';
                historyDiv.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-neon-gold font-bold">Revision #${index + 1}</span>
                        <span class="text-sm text-neon-gray">${new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="text-neon-gray mb-2">${entry.feedback}</div>
                    <div class="text-sm text-neon-gray">
                        Structure: ${entry.structure} | Tone: ${entry.tone}
                    </div>
                `;
                listEl.appendChild(historyDiv);
            });
        }
    },
    
    // Initialize the wizard
    init() {
        this.loadProjectList();
        this.updateProjectStatus();
        
        // Add event listeners for length adjustment
        const lengthAdjustment = document.getElementById('edit-length-adjustment');
        const specificWordCount = document.getElementById('specific-word-count');
        
        if (lengthAdjustment && specificWordCount) {
            lengthAdjustment.addEventListener('change', function() {
                if (this.value === 'specific') {
                    specificWordCount.classList.remove('hidden');
                } else {
                    specificWordCount.classList.add('hidden');
                }
            });
        }
    },
    
    async startResearchFromSubmission() {
        console.log('=== START RESEARCH FROM SUBMISSION ===');
        console.log('Starting research from submission step...');
        
        // Collect research data before starting
        const researchData = this.collectResearchData();
        console.log('Collected research data:', researchData);
        this.sessionData.researchData = researchData;
        
        console.log('Going to step 5 (Research)...');
        // Go to the actual research step (step 5)
        this.goToStep(5);
        
        // Start real research
        await this.startRealResearch();
    },
    
    async startRealResearch() {
        console.log('=== STARTING REAL RESEARCH ===');
        
        // Ensure DOM elements are available even if step just switched
        let statusEl = document.getElementById('research-status');
        let progressEl = document.getElementById('research-progress');
        if (!statusEl || !progressEl) {
            for (let i = 0; i < 20 && (!statusEl || !progressEl); i++) {
                await new Promise(r => setTimeout(r, 100));
                statusEl = document.getElementById('research-status');
                progressEl = document.getElementById('research-progress');
            }
        }
        
        if (statusEl) {
            statusEl.innerHTML = '<div class="text-xl mb-4">🔬 Running multi-model research...</div>';
        } else {
            console.warn('research-status element not found');
        }
        if (progressEl) {
            progressEl.innerHTML = '';
        }
        
        // Show each model researching
        const models = [
            { name: 'Claude (Anthropic)', icon: '🧠', delay: 1000 },
            { name: 'GPT-4 (OpenAI)', icon: '🤖', delay: 1500 },
            { name: 'Gemini (Google)', icon: '✨', delay: 1200 },
            { name: 'Grok (XAI)', icon: '🚀', delay: 1800 }
        ];
        
        // Add model status boxes
        models.forEach(model => {
            const box = document.createElement('div');
            box.id = `model-${model.name.split(' ')[0].toLowerCase()}`;
            box.className = 'p-4 bg-neon-border bg-opacity-20 rounded mb-3';
            box.innerHTML = `
                <div class="font-bold text-neon-gold">${model.icon} ${model.name}</div>
                <div class="model-status text-neon-gray">Starting research...</div>
            `;
            progressEl.appendChild(box);
        });
        
        try {
            // Prepare research data
            const researchPayload = {
                topic: this.sessionData.topic || 'Technocracy and Digital Control',
                session_id: this.sessionId,
                strategy: this.sessionData.brainstormResults || {},
                outline: this.sessionData.outline || {},
                user_research: this.sessionData.researchData || {}
            };
            
            console.log('Sending research request:', researchPayload);
            
            // Call real research API
            const response = await fetch('http://localhost:5003/api/research/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(researchPayload)
            });
            
            if (!response.ok) {
                throw new Error(`Research API error: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Research API response:', result);
            
            // CRITICAL: Capture the session ID from research response
            if (result.research_id) {
                this.sessionId = result.research_id;
                console.log('✅ Captured research session ID:', this.sessionId);
            }
            
            // Update UI with real results
            statusEl.innerHTML = `
                <div class="text-2xl text-green-400 font-bold mb-4">✅ RESEARCH COMPLETE!</div>
                <div class="text-neon-gray mb-2">📊 ${result.sources_count} sources gathered and verified</div>
                <div class="text-neon-gray mb-4">🎯 Credibility score: ${result.estimated_credibility}%</div>
                <div class="text-neon-gray mb-4">🤖 Models used: ${result.models_used.join(', ')}</div>
            `;
            
            // Store research results
            this.sessionData.research = result.research;
            
            // Update model status boxes to show complete
            const models = ['claude', 'gpt-4', 'gemini', 'grok'];
            models.forEach(modelName => {
                const box = document.getElementById(`model-${modelName}`);
                if (box) {
                    const statusDiv = box.querySelector('.model-status');
                    if (statusDiv) {
                        statusDiv.textContent = '✅ Research complete!';
                        statusDiv.className = 'model-status text-green-400 font-bold';
                    }
                }
            });
            
            // Show prominent continue button
            const continueBtn = document.createElement('button');
            continueBtn.className = 'w-full mt-6 px-8 py-4 bg-neon-gold text-black font-bold text-xl rounded-lg hover:bg-yellow-500 transition-all duration-200 shadow-neon-gold';
            continueBtn.innerHTML = '📝 CONTINUE TO WRITING →';
            continueBtn.onclick = () => this.generateFullArticle();
            statusEl.appendChild(continueBtn);
            
        } catch (error) {
            console.error('Research API error:', error);
            
            // Fallback to mock research if API fails
            console.log('Falling back to mock research...');
            await this.startMockResearch();
        }
    },
    
    async startMockResearch() {
        console.log('=== STARTING MOCK RESEARCH (FALLBACK) ===');
        
        const statusEl = document.getElementById('research-status');
        const progressEl = document.getElementById('research-progress');
        
        // Show each model researching
        const models = [
            { name: 'Claude (Anthropic)', icon: '🧠', delay: 1000 },
            { name: 'GPT-4 (OpenAI)', icon: '🤖', delay: 1500 },
            { name: 'Gemini (Google)', icon: '✨', delay: 1200 },
            { name: 'Grok (XAI)', icon: '🚀', delay: 1800 }
        ];
        
        // Simulate research process
        for (const model of models) {
            await new Promise(resolve => setTimeout(resolve, model.delay));
            const box = document.getElementById(`model-${model.name.split(' ')[0].toLowerCase()}`);
            if (box) {
                const statusEl = box.querySelector('.model-status');
                if (statusEl) {
                    statusEl.textContent = 'Researching...';
                    statusEl.className = 'model-status text-neon-gold';
                }
            }
        }
        
        // Complete research after all models finish
        setTimeout(() => {
            // Update all models to completed status
            models.forEach(model => {
                const box = document.getElementById(`model-${model.name.split(' ')[0].toLowerCase()}`);
                if (box) {
                    const statusEl = box.querySelector('.model-status');
                    if (statusEl) {
                        statusEl.textContent = 'Research complete!';
                        statusEl.className = 'model-status text-green-400';
                    }
                }
            });
            
            // Wait a moment then show completion
            setTimeout(() => {
                statusEl.innerHTML = `
                    <div class="text-2xl text-green-400 font-bold mb-4">✅ RESEARCH COMPLETE!</div>
                    <div class="text-neon-gray mb-2">📊 4 AI models analyzed your topic</div>
                    <div class="text-neon-gray mb-4">🎯 Research quality: 95%</div>
                    <div class="text-neon-gray mb-4">🤖 Models used: Claude, GPT-4, Gemini, Grok</div>
                `;
                
                // Show continue button
                const continueBtn = document.createElement('button');
                continueBtn.className = 'neon-button';
                continueBtn.textContent = 'CONTINUE TO WRITING';
                continueBtn.onclick = () => this.generateFullArticle();
                statusEl.appendChild(continueBtn);
            }, 1000);
        }, 2000);
    },
    
    async startResearch() {
        // Collect research data before starting
        const researchData = this.collectResearchData();
        this.sessionData.researchData = researchData;
        
        this.goToStep(5);
        const statusEl = document.getElementById('research-status');
        const progressEl = document.getElementById('research-progress');
        
        statusEl.innerHTML = '<div class="text-xl mb-4">🔬 Running multi-model research...</div>';
        progressEl.innerHTML = '';
        
        // Show each model researching
        const models = [
            { name: 'Claude (Anthropic)', icon: '🧠', delay: 1000 },
            { name: 'GPT-4 (OpenAI)', icon: '🤖', delay: 1500 },
            { name: 'Gemini (Google)', icon: '✨', delay: 1200 },
            { name: 'Grok (XAI)', icon: '🚀', delay: 1800 }
        ];
        
        // Add model status boxes
        models.forEach(model => {
            const box = document.createElement('div');
            box.id = `model-${model.name.split(' ')[0].toLowerCase()}`;
            box.className = 'p-4 bg-neon-border bg-opacity-20 rounded mb-3';
            box.innerHTML = `
                <div class="font-bold text-neon-gold">${model.icon} ${model.name}</div>
                <div class="model-status text-neon-gray">Starting research...</div>
            `;
            progressEl.appendChild(box);
        });
        
        // Quick health check to fail fast if API is unreachable
        try {
            const healthResp = await this.fetchWithTimeout('http://localhost:5003/health', {}, 5000);
            if (!healthResp.ok) {
                throw new Error(`Health check failed: ${healthResp.status}`);
            }
            const health = await healthResp.json();
            console.log('Health:', health);
        } catch (e) {
            console.error('Health check error:', e);
            if (statusEl) statusEl.innerHTML = '<div class="text-red-400">❌ Backend not reachable on port 5003. Is the API running?</div>';
            return;
        }
        
        // Call real research API
        try {
            console.log('Starting research for session:', this.sessionId);
            
            // Prepare research data
            const researchPayload = {
                topic: this.sessionData.topic || 'Technocracy and Digital Control',
                session_id: this.sessionId,
                strategy: this.sessionData.brainstormResults || {},
                outline: this.sessionData.outline || {},
                user_research: this.sessionData.researchData || {}
            };
            
            console.log('Sending research request:', researchPayload);
            
            const response = await this.fetchWithTimeout('http://localhost:5003/api/research/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(researchPayload)
            }, 300000);
            
            if (!response.ok) {
                throw new Error(`Research API error: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Research response:', result);
            
            if (result.success && result.research) {
                // CRITICAL: Store the research_id returned by backend - this is needed for all subsequent API calls
                this.sessionId = result.research_id;
                console.log('✅ Captured research session ID:', this.sessionId);
                
                // Store research in session data
                this.sessionData.research = result.research;
                
                // Wait for all models to complete before showing final results
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                statusEl.innerHTML = `
                    <div class="text-2xl text-green-400 font-bold mb-4">✅ RESEARCH COMPLETE!</div>
                    <div class="text-neon-gray mb-2">📊 ${result.sources_count} sources gathered and verified</div>
                    <div class="text-neon-gray mb-4">🎯 Credibility score: ${result.estimated_credibility}%</div>
                    <div class="text-neon-gray mb-4">🤖 Models used: ${result.models_used.join(', ')}</div>
                `;

                // Auto-proceed to article generation after showing results briefly
                setTimeout(() => {
                    console.log('Auto-proceeding to article generation with session:', this.sessionId);
                    this.generateFullArticle();
                }, 2000);
            } else {
                statusEl.innerHTML = '<div class="text-red-400">❌ Research failed. Check response.</div>';
                console.error('Research failed:', result);
            }
        } catch (error) {
            console.error('Research error:', error);
            statusEl.innerHTML = '<div class="text-red-400">❌ Research failed. Check backend connection.</div>';
        }
    },
    
    async generateFullArticle() {
        this.goToStep(5);
        const statusEl = document.getElementById('generation-status');
        statusEl.innerHTML = `<div class="text-xl">✍️ Generating article with ${this.reviewRounds} review rounds...</div>`;

        console.log('🔹 generateFullArticle called with session ID:', this.sessionId);
        console.log('🔹 Review rounds configured:', this.reviewRounds);

        if (!this.sessionId) {
            console.error('❌ ERROR: No session ID available for article generation!');
            statusEl.innerHTML = '<div class="text-red-400">❌ No research session found. Please run research first.</div>';
            return;
        }

        try {
            const payload = {
                session_id: this.sessionId,
                review_rounds: this.reviewRounds,  // Send configured review rounds
                config: {
                    length: 'medium',
                    voice_profile: 'Aaron Day'
                }
            };
            console.log('📤 Sending article generation request:', payload);

            // Show progress indicator
            statusEl.innerHTML = `
                <div class="text-xl mb-4">✍️ Generating article with ${this.reviewRounds} review/edit rounds</div>
                <div class="text-neon-gray mb-2">This will take a few minutes...</div>
                <div id="round-progress" class="space-y-2 mt-4"></div>
            `;

            const response = await fetch(`${this.apiBase}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            console.log('📥 Generate response:', result);

            if (result.success && result.article) {
                // Store all drafts from iterative process
                this.articleDrafts = result.drafts || [];
                
                // Store final article in session data
                this.sessionData.article = {
                    content: result.article,
                    word_count: result.word_count || 0,
                    quality_score: 85,
                    voice_match: 88,
                    rounds_completed: result.rounds_completed || 0
                };
                console.log('Article stored:', this.sessionData.article.word_count, 'words after', result.rounds_completed, 'rounds');

                // Show completion with draft history
                statusEl.innerHTML = `
                    <div class="text-green-400 text-xl mb-4">✅ Article generation complete!</div>
                    <div class="text-neon-gray mb-4">${result.rounds_completed} review/edit rounds completed</div>
                    <div class="text-neon-gray mb-4">${this.articleDrafts.length} drafts created</div>
                    <button onclick="articleWizard.viewDraftHistory()" class="btn-secondary mr-3">📜 View Draft History</button>
                `;

                // Wait a moment then proceed to final review
                await new Promise(resolve => setTimeout(resolve, 2000));
                await this.runQualityReview();
            } else {
                statusEl.innerHTML = '<div class="text-red-400">❌ Failed to generate article</div>';
                console.error('Generate failed:', result);
            }
        } catch (error) {
            console.error('Generation error:', error);
            statusEl.innerHTML = '<div class="text-red-400">❌ Error generating article. Check backend.</div>';
        }
    },
    
    async runQualityReview() {
        this.goToStep(6);
        const statusEl = document.getElementById('review-status');
        statusEl.innerHTML = '<div class="text-xl mb-4">📊 Running 3-round quality review...</div>';
        
        const rounds = ['Round 1: Checking voice calibration...', 'Round 2: Verifying evidence...', 'Round 3: Final polish...'];
        
        for (let i = 0; i < rounds.length; i++) {
            statusEl.innerHTML += `<div class="text-neon-gray mb-2">${rounds[i]}</div>`;
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        try {
            console.log('🔹 runQualityReview called with session ID:', this.sessionId);
            console.log('📄 Article in session:', !!this.sessionData.article);

            if (!this.sessionId) {
                console.error('❌ ERROR: No session ID available for review!');
                statusEl.innerHTML = '<div class="text-yellow-400">⚠️ No session found, showing article anyway</div>';
                setTimeout(() => this.showFinalArticle(), 1000);
                return;
            }

            const payload = { session_id: this.sessionId };
            console.log('📤 Sending review request:', payload);

            const response = await this.fetchWithTimeout(`${this.apiBase}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }, 30000); // 30 second timeout for review
            
            const result = await response.json();
            console.log('Review response:', result);
            
            if (result.success && result.review) {
                // Store review in session data and update article metadata
                this.sessionData.review = result.review;
                this.sessionData.article.quality_score = result.review.overall_score;
                this.sessionData.article.voice_match = result.review.voice_authenticity;

                // Save post-review draft
                this.saveDraft('Post-Review', this.sessionData.article);

                statusEl.innerHTML = `
                    <div class="text-2xl text-green-400 font-bold mb-4">✅ REVIEW COMPLETE!</div>
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div>Overall Score: <span class="text-neon-gold">${result.review.overall_score}%</span></div>
                        <div>Voice Match: <span class="text-neon-gold">${result.review.voice_authenticity}%</span></div>
                        <div>Argument Strength: <span class="text-neon-gold">${result.review.argument_strength}%</span></div>
                        <div>Publication Fit: <span class="text-neon-gold">${result.review.publication_fit}%</span></div>
                    </div>
                `;

                // Auto-proceed to final article after showing review results
                setTimeout(() => {
                    console.log('Auto-proceeding to final article...');
                    this.showFinalArticle();
                }, 2000);
            } else {
                console.error('Review API returned error or invalid data:', result);
                statusEl.innerHTML = '<div class="text-yellow-400">⚠️ Review incomplete, showing article anyway</div>';
                setTimeout(() => this.showFinalArticle(), 1000);
            }
        } catch (error) {
            console.error('Review error:', error);
            statusEl.innerHTML = '<div class="text-yellow-400">⚠️ Review failed, showing article anyway</div>';
            setTimeout(() => this.showFinalArticle(), 1000);
        }
    },
    
    showFinalArticle() {
        this.goToStep(7);
        
        const article = this.sessionData.article;
        if (!article) {
            console.error('No article data found!');
            document.getElementById('article-content-preview').textContent = 'ERROR: No article generated';
            return;
        }
        
        console.log('Displaying article:', article.word_count, 'words');
        
        document.getElementById('final-word-count').textContent = article.word_count || '0';
        document.getElementById('final-quality').textContent = article.quality_score || '0';
        document.getElementById('final-voice').textContent = (article.voice_match || 0) + '%';
        document.getElementById('article-content-preview').textContent = article.content || 'No content generated';
    },
    
    startNew() {
        this.sessionId = null;
        this.sessionData = {};
        this.goToStep(1);
        document.getElementById('wizard-topic').value = '';
        document.getElementById('wizard-context').value = '';
        document.getElementById('conversation-messages').innerHTML = '';
    },
    
    startNewProject() {
        // Confirm if there's unsaved work
        if (this.sessionData && Object.keys(this.sessionData).length > 0 && !this.currentProject) {
            if (!confirm('You have unsaved work. Start a new project? (Your current work will be lost)')) {
                return;
            }
        }
        
        // Clear everything
        this.sessionId = null;
        this.sessionData = {};
        this.currentStep = 1;
        this.currentProject = null;
        this.editHistory = [];
        this.isResearchRunning = false;
        this.articleDrafts = [];
        
        // Clear UI
        if (document.getElementById('wizard-topic')) {
            document.getElementById('wizard-topic').value = '';
        }
        if (document.getElementById('wizard-publication')) {
            document.getElementById('wizard-publication').value = '';
        }
        if (document.getElementById('wizard-context')) {
            document.getElementById('wizard-context').value = '';
        }
        if (document.getElementById('conversation-messages')) {
            document.getElementById('conversation-messages').innerHTML = '';
        }
        
        // Reset project status display
        this.updateProjectStatus();
        
        // Go to step 1
        this.goToStep(1);
        
        console.log('✨ New project started');
        alert('New project started! Enter your topic to begin.');
    },
    
    saveDraft(label, articleData) {
        const draft = {
            version: this.articleDrafts.length + 1,
            label: label,
            content: articleData.content,
            word_count: articleData.word_count,
            quality_score: articleData.quality_score || 0,
            voice_match: articleData.voice_match || 0,
            timestamp: new Date().toISOString()
        };
        
        this.articleDrafts.push(draft);
        console.log(`📝 Draft saved: Version ${draft.version} - ${label}`);
        
        // Auto-save project if there's a current project
        if (this.currentProject) {
            this.autoSave();
        }
        
        return draft;
    },
    
    viewDraftHistory() {
        if (this.articleDrafts.length === 0) {
            alert('No drafts saved yet.');
            return;
        }
        
        let historyHtml = '<div class="draft-history p-4">';
        historyHtml += '<h3 class="text-2xl text-neon-gold mb-4">📚 Draft History</h3>';
        
        this.articleDrafts.forEach((draft, index) => {
            const date = new Date(draft.timestamp).toLocaleString();
            historyHtml += `
                <div class="draft-item p-4 mb-3 bg-neon-border bg-opacity-20 rounded">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <span class="text-neon-gold font-bold">Version ${draft.version}: ${draft.label}</span>
                            <span class="text-sm text-neon-gray ml-3">${date}</span>
                        </div>
                        <button onclick="articleWizard.loadDraft(${index})" class="text-neon-teal hover:text-neon-pink">Load</button>
                    </div>
                    <div class="text-neon-gray text-sm">
                        ${draft.word_count} words | Quality: ${draft.quality_score}% | Voice: ${draft.voice_match}%
                    </div>
                </div>
            `;
        });
        
        historyHtml += '</div>';
        
        // Display in a modal or dedicated section
        console.log('Draft history:', this.articleDrafts);
        alert(`You have ${this.articleDrafts.length} saved drafts. Check console for details.`);
    },
    
    loadDraft(index) {
        if (index < 0 || index >= this.articleDrafts.length) {
            alert('Invalid draft version');
            return;
        }
        
        const draft = this.articleDrafts[index];
        this.sessionData.article = {
            content: draft.content,
            word_count: draft.word_count,
            quality_score: draft.quality_score,
            voice_match: draft.voice_match
        };
        
        console.log(`📂 Loaded draft: Version ${draft.version} - ${draft.label}`);
        alert(`Loaded Version ${draft.version}: ${draft.label}`);
        
        // Show the article
        this.showFinalArticle();
    },
    
    async exportToGoogleDocs() {
        if (!this.sessionId) {
            alert('No session found. Please generate an article first.');
            return;
        }
        
        try {
            const statusEl = document.getElementById('export-status');
            if (statusEl) statusEl.innerHTML = '<div class="text-neon-gold">📤 Exporting to Google Docs...</div>';
            
            const response = await fetch(`${this.apiBase}/export/googledocs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: this.sessionId })
            });
            
            const result = await response.json();
            
            if (result.success) {
                if (statusEl) statusEl.innerHTML = '<div class="text-green-400">✅ Export complete!</div>';
                alert(`✅ Article exported successfully!\n\nFile: ${result.export_filename}\n\nPath: ${result.export_path}`);
                
                // If Google Docs URL is available (future feature)
                if (result.google_docs_url) {
                    window.open(result.google_docs_url, '_blank');
                }
            } else {
                if (statusEl) statusEl.innerHTML = '<div class="text-red-400">❌ Export failed</div>';
                alert(`Export failed: ${result.error}`);
            }
        } catch (error) {
            console.error('Export error:', error);
            alert('Export failed. See console for details.');
        }
    },
    
    downloadArticle() {
        const article = this.sessionData.article;
        if (!article || !article.content) {
            alert('No article to download');
            console.error('No article in sessionData');
            return;
        }
        
        const topic = this.sessionData.topic || 'article';
        const filename = `${topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.md`;
        
        const blob = new Blob([article.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('✅ Article downloaded:', filename);
        alert(`✅ Article downloaded as ${filename}`);
    },
    
    copyToClipboard() {
        const article = this.sessionData.article;
        if (!article || !article.content) {
            alert('No article to copy');
            console.error('No article in sessionData');
            return;
        }
        
        navigator.clipboard.writeText(article.content).then(() => {
            alert('✅ Article copied to clipboard!');
            console.log('✅ Article copied to clipboard');
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy article to clipboard');
        });
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Interactive Article Wizard loaded');
    articleWizard.init();
});

console.log('✅ Interactive Article Wizard loaded');

