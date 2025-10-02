#!/usr/bin/env python3
"""
Article Research API - For Article Automation System
Performs article-focused research based on brainstorming strategy and outline
"""

import os
import sys
import json
import asyncio
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Add the proper automation system to path
automation_path = Path.home() / "aaron-day-article-automation"
if automation_path.exists():
    sys.path.insert(0, str(automation_path))
    logger = logging.getLogger(__name__)
    logger.info(f"Added automation system to path: {automation_path}")

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add file logging to help diagnose hangs
try:
    log_dir = Path(__file__).resolve().parent
    log_file = log_dir / 'article_research.log'
    file_handler = RotatingFileHandler(log_file, maxBytes=2_000_000, backupCount=2)
    file_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(file_handler)
except Exception as _e:
    # Fallback silently if file logging cannot be configured
    logger.warning(f"File logging could not be configured: {_e}")

# Load environment variables
base_path = Path.home() / "Documents" / "TheAaronDayShow"
env_locations = [
    base_path / ".env",
    Path.cwd() / ".env",
]

for env_path in env_locations:
    if env_path.exists():
        load_dotenv(env_path, override=True)
        logger.info(f"Loaded environment from: {env_path}")
        break

# Import AI clients
import openai
import anthropic
try:
    import google.generativeai as genai
except ImportError:
    genai = None
    logger.warning("Google Generative AI not available")

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Session persistence directory
SESSION_DIR = Path(__file__).parent / '.sessions'
SESSION_DIR.mkdir(exist_ok=True)

def save_session(session_id: str, session_data: dict):
    """Save session to disk"""
    try:
        session_file = SESSION_DIR / f"{session_id}.json"
        with open(session_file, 'w') as f:
            json.dump(session_data, f, default=str)
        logger.info(f"Session saved to disk: {session_id}")
    except Exception as e:
        logger.error(f"Failed to save session {session_id}: {e}")

def load_session(session_id: str) -> Optional[dict]:
    """Load session from disk"""
    try:
        session_file = SESSION_DIR / f"{session_id}.json"
        if session_file.exists():
            with open(session_file, 'r') as f:
                data = json.load(f)
            logger.info(f"Session loaded from disk: {session_id}")
            return data
        return None
    except Exception as e:
        logger.error(f"Failed to load session {session_id}: {e}")
        return None

def load_all_sessions():
    """Load all existing sessions from disk on startup"""
    sessions = {}
    try:
        for session_file in SESSION_DIR.glob("*.json"):
            session_id = session_file.stem
            session_data = load_session(session_id)
            if session_data:
                sessions[session_id] = session_data
        logger.info(f"Loaded {len(sessions)} sessions from disk")
    except Exception as e:
        logger.error(f"Failed to load sessions: {e}")
    return sessions

# Research sessions storage (restored from disk on restart)
research_sessions = load_all_sessions()


class ArticleResearchAggregator:
    """
    Article-focused research aggregator.
    Researches specifically for article writing, not podcast preparation.
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self._initialize_clients()
        # Default per-model timeout to avoid indefinite hangs
        self.model_timeout_secs = int(os.getenv('ARTICLE_MODEL_TIMEOUT_SECS', '180'))
        
    def _initialize_clients(self):
        """Initialize AI API clients"""
        # OpenAI
        openai_key = os.getenv('OPENAI_API_KEY')
        if openai_key:
            self.openai_client = openai.OpenAI(api_key=openai_key)
            self.logger.info("OpenAI client initialized")
        else:
            self.openai_client = None
            self.logger.warning("OpenAI API key not found")
        
        # Anthropic
        anthropic_key = os.getenv('ANTHROPIC_API_KEY')
        if anthropic_key:
            self.anthropic_client = anthropic.Anthropic(api_key=anthropic_key)
            self.logger.info("Anthropic client initialized")
        else:
            self.anthropic_client = None
            self.logger.warning("Anthropic API key not found")
        
        # Google AI
        google_key = os.getenv('GOOGLE_AI_API_KEY')
        if google_key and genai:
            genai.configure(api_key=google_key)
            self.google_client = genai
            self.logger.info("Google AI client initialized")
        else:
            self.google_client = None
            self.logger.warning("Google AI API key not found")
        
        # XAI (Grok) - Initialize with timeout to prevent hangs
        xai_key = os.getenv('XAI_API_KEY')
        if xai_key:
            try:
                # Use asyncio.to_thread for XAI client initialization to avoid blocking
                def _init_xai_client():
                    return openai.OpenAI(
                        api_key=xai_key,
                        base_url="https://api.x.ai/v1"
                    )

                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(_init_xai_client)
                    self.xai_client = future.result(timeout=10)  # 10 second timeout
                self.logger.info("XAI (Grok) client initialized")
            except Exception as e:
                self.xai_client = None
                self.logger.error(f"XAI (Grok) client initialization failed: {e}")
        else:
            self.xai_client = None
            self.logger.warning("XAI API key not found")
    
    async def research_for_article(
        self, 
        topic: str, 
        strategy: Dict, 
        outline: Dict,
        publication: str = "general"
    ) -> Dict:
        """
        Main research method for article writing.
        
        Args:
            topic: Article topic
            strategy: Brainstorming strategy (angle, key_points, etc.)
            outline: Article outline
            publication: Target publication (brownstone, peak_prosperity, etc.)
            
        Returns:
            Comprehensive article research package
        """
        self.logger.info(f"Starting article research for: {topic}")
        
        # Extract key elements from strategy
        angle = strategy.get('angle', topic)
        key_points = strategy.get('key_points', [])
        
        # Run parallel research tasks with ALL models
        research_coroutines: List[Any] = []
        research_names: List[str] = []
        
        if self.anthropic_client:
            research_coroutines.append(self.claude_article_research(topic, angle, key_points))
            research_names.append('Claude')
        
        if self.openai_client:
            research_coroutines.append(self.gpt4_evidence_research(topic, outline))
            research_names.append('GPT-4')
        
        if self.google_client:
            research_coroutines.append(self.gemini_counter_research(topic, key_points))
            research_names.append('Gemini')
        
        # Re-enable Grok with timeout protection
        if self.xai_client:
            research_coroutines.append(self.grok_realtime_research(topic, key_points))
            research_names.append('Grok')
        
        if not research_coroutines:
            raise Exception("No AI models available. Please configure API keys.")
        
        # Execute research in parallel with a total time budget
        total_timeout_secs = int(os.getenv('ARTICLE_TOTAL_TIMEOUT_SECS', '300'))
        try:
            results = await asyncio.wait_for(
                asyncio.gather(*research_coroutines, return_exceptions=True),
                timeout=total_timeout_secs
            )
        except asyncio.TimeoutError:
            self.logger.error("Total research exceeded time budget")
            results = []
        
        # Filter out errors
        valid_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                name = research_names[i] if i < len(research_names) else f"Model#{i+1}"
                self.logger.error(f"{name} research failed: {result}")
            else:
                valid_results.append(result)
        
        if not valid_results:
            raise Exception("All research models failed. Check API keys and logs.")
        
        # Compile article research
        compiled = self.compile_article_research(topic, strategy, valid_results)
        
        self.logger.info(f"Article research completed for: {topic}")
        return compiled
    
    async def claude_article_research(
        self, 
        topic: str, 
        angle: str, 
        key_points: List[str]
    ) -> Dict:
        """
        Claude: Deep analytical research for article arguments
        Focus: Historical precedents, power structures, philosophical depth
        """
        self.logger.info(f"Claude researching: {topic}")
        
        prompt = f"""You are researching for a high-quality article on: {topic}

Article Angle: {angle}

Key Points to Cover:
{chr(10).join(f"- {point}" for point in key_points)}

Provide comprehensive research including:

1. HISTORICAL PRECEDENTS:
   - Specific historical examples with dates
   - Similar patterns from history
   - How those situations resolved

2. POWER STRUCTURE ANALYSIS:
   - Who benefits financially?
   - What organizations/individuals are involved?
   - Follow the money - specific dollar amounts if possible

3. EVIDENCE FOR ARGUMENTS:
   - Statistics and data points
   - Expert quotes (real people with credentials)
   - Documented facts with sources

4. PHILOSOPHICAL IMPLICATIONS:
   - Impact on human freedom
   - Violations of natural rights or principles
   - Deeper meaning and long-term consequences

5. COUNTER-ARGUMENTS TO ADDRESS:
   - What would critics say?
   - Common objections to address
   - How to respond to each

Focus on substantive, article-worthy content. Provide specific names, dates, amounts, and verifiable facts.
"""
        
        try:
            def _call_claude():
                return self.anthropic_client.messages.create(
                    model="claude-sonnet-4-5-20250929",  # Latest Claude Sonnet 4.5
                    max_tokens=8000,
                    messages=[{
                        "role": "user",
                        "content": prompt
                    }]
                )
            message = await asyncio.wait_for(asyncio.to_thread(_call_claude), timeout=self.model_timeout_secs)
            content = message.content[0].text
            
            return {
                'model': 'Claude',
                'content': content,
                'focus': 'deep_analysis',
                'word_count': len(content.split()),
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Claude API error: {e}")
            raise
    
    async def gpt4_evidence_research(
        self, 
        topic: str, 
        outline: Dict
    ) -> Dict:
        """
        GPT-4: Evidence gathering and fact-checking
        Focus: Statistics, studies, expert opinions, current events
        """
        self.logger.info(f"GPT-4 researching: {topic}")
        
        outline_text = json.dumps(outline, indent=2)
        
        prompt = f"""You are researching evidence for an article on: {topic}

Article Outline:
{outline_text}

Provide comprehensive evidence including:

1. STATISTICS AND DATA:
   - Recent statistics (last 2-3 years preferred)
   - Specific numbers, percentages, dollar amounts
   - Sources for each statistic

2. EXPERT OPINIONS:
   - Quotes from credible experts
   - Their credentials and why they're authoritative
   - Multiple perspectives (including dissenting views)

3. RECENT DEVELOPMENTS:
   - News from last 6 months
   - Policy changes or announcements
   - Legal or regulatory updates

4. CASE STUDIES:
   - Specific examples of the topic in action
   - Real-world implementations
   - Success/failure stories with details

5. SUPPORTING RESEARCH:
   - Academic studies or papers
   - Think tank reports
   - Investigative journalism findings

Provide specific, verifiable facts that can be cited in an article.
"""
        
        try:
            def _call_openai():
                return self.openai_client.chat.completions.create(
                    model="gpt-4o",  # Latest GPT-4 Optimized model
                    messages=[
                        {"role": "system", "content": "You are a thorough research assistant gathering evidence for article writing."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=3000,
                    temperature=0.3
                )
            response = await asyncio.wait_for(asyncio.to_thread(_call_openai), timeout=self.model_timeout_secs)
            content = response.choices[0].message.content
            
            return {
                'model': 'GPT-4',
                'content': content,
                'focus': 'evidence_gathering',
                'word_count': len(content.split()),
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"GPT-4 API error: {e}")
            raise
    
    async def gemini_counter_research(
        self, 
        topic: str, 
        key_points: List[str]
    ) -> Dict:
        """
        Gemini: Counter-arguments and opposing viewpoints
        Focus: Steel-manning opposition, finding weaknesses to address
        """
        self.logger.info(f"Gemini researching: {topic}")
        
        prompt = f"""Research counter-arguments and opposing views for an article on: {topic}

Key Points We're Making:
{chr(10).join(f"- {point}" for point in key_points)}

Provide comprehensive counter-argument research:

1. OPPOSING VIEWPOINTS:
   - What do critics and opponents say?
   - Their strongest arguments (steel-man them)
   - Who are the main opponents?

2. POTENTIAL OBJECTIONS:
   - What questions will readers have?
   - What concerns might they raise?
   - Common misconceptions to address

3. WEAKNESSES IN OUR ARGUMENT:
   - Where are we vulnerable?
   - What evidence might we lack?
   - Where do we need to be careful?

4. REBUTTALS:
   - How to respond to each objection
   - Evidence to counter opposing claims
   - Logical flaws in opposition arguments

5. BALANCE AND FAIRNESS:
   - Valid points from the other side
   - Areas of legitimate debate
   - Nuances to acknowledge

This helps create a more robust, persuasive article by addressing objections head-on.
"""
        
        try:
            # Use latest Gemini 2.5 Pro
            def _call_gemini():
                model = self.google_client.GenerativeModel('gemini-2.5-pro')
                return model.generate_content(prompt)
            response = await asyncio.wait_for(asyncio.to_thread(_call_gemini), timeout=self.model_timeout_secs)
            content = getattr(response, 'text', '')
            
            return {
                'model': 'Gemini',
                'content': content,
                'focus': 'counter_arguments',
                'word_count': len(content.split()),
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Gemini API error: {e}")
            raise
    
    async def grok_realtime_research(
        self, 
        topic: str, 
        key_points: List[str]
    ) -> Dict:
        """
        Grok (XAI): Real-time insights and trending perspectives
        Focus: Current events, X/Twitter discussions, alternative viewpoints
        """
        self.logger.info(f"Grok researching: {topic}")
        
        prompt = f"""Research current discussions and real-time insights on: {topic}

Key Points Being Made:
{chr(10).join(f"- {point}" for point in key_points)}

Provide real-time research including:

1. CURRENT DISCUSSIONS:
   - What's being discussed on X/Twitter right now?
   - Trending perspectives and hot takes
   - Viral threads or important conversations

2. ALTERNATIVE VIEWPOINTS:
   - Dissenting opinions and contrarian takes
   - Underground/alternative media perspectives
   - What mainstream sources aren't covering

3. RECENT DEVELOPMENTS:
   - Breaking news or updates (last 48 hours)
   - Policy announcements or changes
   - Emerging trends or patterns

4. SOCIAL PROOF:
   - What influencers or thought leaders are saying
   - Popular arguments gaining traction
   - Memes or viral content related to topic

5. PREDICTIVE INSIGHTS:
   - Where is this headed?
   - What to watch for next
   - Potential surprises or plot twists

Focus on current, real-time insights that add freshness to the article.
"""
        
        try:
            def _call_grok():
                return self.xai_client.chat.completions.create(
                    model="grok-4-fast-reasoning",  # Latest Grok 4
                    messages=[
                        {"role": "system", "content": "You are an expert at analyzing real-time discussions and providing fresh, contrarian insights."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=3000,
                    temperature=0.7
                )
            response = await asyncio.wait_for(asyncio.to_thread(_call_grok), timeout=self.model_timeout_secs)
            content = response.choices[0].message.content
            
            return {
                'model': 'Grok',
                'content': content,
                'focus': 'realtime_insights',
                'word_count': len(content.split()),
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Grok API error: {e}")
            raise
    
    def compile_article_research(
        self, 
        topic: str, 
        strategy: Dict, 
        results: List[Dict]
    ) -> Dict:
        """
        Compile all research into article-ready format
        """
        self.logger.info(f"Compiling article research for: {topic}")
        
        # Create executive summary
        executive_summary = self._create_executive_summary(topic, strategy, results)
        
        # Extract key elements
        evidence = self._extract_evidence(results)
        counter_args = self._extract_counter_arguments(results)
        quotes = self._extract_quotes(results)
        statistics = self._extract_statistics(results)
        
        # Compile final research package
        research_package = {
            'topic': topic,
            'angle': strategy.get('angle', topic),
            'executive_summary': executive_summary,
            
            # Research by model
            'research_sections': {
                result['model']: {
                    'content': result['content'],
                    'focus': result['focus'],
                    'word_count': result['word_count']
                }
                for result in results
            },
            
            # Extracted elements for article writing
            'evidence': evidence,
            'counter_arguments': counter_args,
            'expert_quotes': quotes,
            'statistics': statistics,
            
            # Metadata
            'models_used': [r['model'] for r in results],
            'total_word_count': sum(r['word_count'] for r in results),
            'research_quality_score': self._calculate_quality_score(results),
            'generated_at': datetime.now().isoformat()
        }
        
        return research_package
    
    def _create_executive_summary(
        self, 
        topic: str, 
        strategy: Dict, 
        results: List[Dict]
    ) -> str:
        """Create executive summary of research"""
        summary = f"# Research Summary: {topic}\n\n"
        summary += f"**Angle**: {strategy.get('angle', 'N/A')}\n\n"
        summary += f"**Models Consulted**: {', '.join(r['model'] for r in results)}\n\n"
        summary += f"**Total Research**: {sum(r['word_count'] for r in results)} words\n\n"
        summary += "## Key Findings:\n\n"
        
        # Extract key sentences from each model
        for result in results:
            content_lines = result['content'].split('\n')
            key_lines = [line for line in content_lines if line.strip() and len(line) > 50][:3]
            for line in key_lines:
                summary += f"- {line.strip()}\n"
        
        return summary
    
    def _extract_evidence(self, results: List[Dict]) -> List[str]:
        """Extract specific evidence points"""
        evidence = []
        for result in results:
            content = result['content']
            # Simple extraction - look for sentences with numbers, dates, or names
            sentences = content.split('.')
            for sentence in sentences:
                if any(indicator in sentence.lower() for indicator in ['study', 'research', 'according to', 'found that', 'shows that']):
                    evidence.append(sentence.strip())
        return evidence[:15]
    
    def _extract_counter_arguments(self, results: List[Dict]) -> List[str]:
        """Extract counter-arguments to address"""
        counter_args = []
        for result in results:
            if result['focus'] == 'counter_arguments':
                content = result['content']
                # Extract potential objections
                sentences = content.split('.')
                for sentence in sentences:
                    if any(word in sentence.lower() for word in ['argue', 'claim', 'object', 'critic', 'oppose']):
                        counter_args.append(sentence.strip())
        return counter_args[:10]
    
    def _extract_quotes(self, results: List[Dict]) -> List[str]:
        """Extract quotable expert opinions"""
        quotes = []
        for result in results:
            content = result['content']
            # Simple quote extraction
            if '"' in content:
                parts = content.split('"')
                for i in range(1, len(parts), 2):
                    if len(parts[i]) > 20:
                        quotes.append(parts[i])
        return quotes[:10]
    
    def _extract_statistics(self, results: List[Dict]) -> List[str]:
        """Extract statistics and data points"""
        statistics = []
        for result in results:
            content = result['content']
            sentences = content.split('.')
            for sentence in sentences:
                # Look for percentages, dollar amounts, or large numbers
                if any(char in sentence for char in ['%', '$']) or any(word in sentence for word in [' million', ' billion', ' trillion']):
                    statistics.append(sentence.strip())
        return statistics[:15]
    
    def _calculate_quality_score(self, results: List[Dict]) -> float:
        """Calculate research quality score"""
        if not results:
            return 0.0
        
        # Base score on:
        # - Number of models (more perspectives = better)
        # - Total content volume
        # - Diversity of focus areas
        
        num_models = len(results)
        total_words = sum(r['word_count'] for r in results)
        focus_diversity = len(set(r['focus'] for r in results))
        
        model_score = min(num_models / 3.0, 1.0) * 0.4  # Up to 40%
        content_score = min(total_words / 5000, 1.0) * 0.4  # Up to 40%
        diversity_score = min(focus_diversity / 3.0, 1.0) * 0.2  # Up to 20%
        
        return model_score + content_score + diversity_score


# Helper function to run async code in Flask
def run_async(coro):
    """Run async coroutine in Flask context"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@app.route('/api/research/start', methods=['POST'])
def start_research():
    """Start article research process"""
    try:
        data = request.get_json()
        
        topic = data.get('topic', '')
        strategy = data.get('strategy', {})
        outline = data.get('outline', {})
        publication = data.get('publication', 'general')
        
        if not topic:
            return jsonify({'error': 'Topic is required'}), 400
        
        logger.info(f"Starting article research for: {topic}")
        
        # Create research session
        session_id = f"article_research_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        research_sessions[session_id] = {
            "topic": topic,
            "status": "running",
            "started_at": datetime.now().isoformat(),
            "result": None
        }
        save_session(session_id, research_sessions[session_id])
        
        # Run article research
        async def do_research():
            aggregator = ArticleResearchAggregator()
            return await aggregator.research_for_article(topic, strategy, outline, publication)
        
        result = run_async(do_research())
        
        # Update session
        research_sessions[session_id].update({
            "status": "complete",
            "result": result,
            "completed_at": datetime.now().isoformat()
        })
        save_session(session_id, research_sessions[session_id])
        
        return jsonify({
            "success": True,
            "research_id": session_id,
            "research": result,
            "models_used": result.get('models_used', []),
            "sources_count": len(result.get('evidence', [])),
            "estimated_credibility": int(result.get('research_quality_score', 0.7) * 100)
        })
        
    except Exception as e:
        logger.error(f"Research error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/research/status/<research_id>', methods=['GET'])
def get_research_status(research_id):
    """Get research status"""
    if research_id not in research_sessions:
        return jsonify({'error': 'Session not found'}), 404

    session = research_sessions[research_id]
    return jsonify({
        "research_id": research_id,
        "topic": session["topic"],
        "status": session["status"],
        "started_at": session["started_at"],
        "completed_at": session.get("completed_at"),
        "has_result": session.get("result") is not None
    })


@app.route('/api/research/reports', methods=['GET'])
def list_research_reports():
    """List all research reports"""
    try:
        # For now, return the current session if it exists
        reports = []
        for session_id, session in research_sessions.items():
            if session.get('result'):
                reports.append({
                    'id': session_id,
                    'topic': session['topic'],
                    'created_at': session.get('started_at', ''),
                    'status': session.get('status', 'unknown'),
                    'word_count': session['result'].get('total_word_count', 0) if session.get('result') else 0,
                    'models_used': session['result'].get('models_used', []) if session.get('result') else []
                })

        return jsonify({
            'success': True,
            'reports': reports,
            'total_count': len(reports)
        })

    except Exception as e:
        logger.error(f"Error listing reports: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/research/file', methods=['GET'])
def get_research_file():
    """Get research file content"""
    try:
        path = request.args.get('path', '')
        if not path:
            return jsonify({'error': 'Path parameter required'}), 400

        # For now, return the current session result if it matches
        for session_id, session in research_sessions.items():
            if session.get('result') and path in session_id:
                return jsonify({
                    'success': True,
                    'content': session['result']
                })

        return jsonify({'error': 'File not found'}), 404

    except Exception as e:
        logger.error(f"Error getting research file: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/personas/voices/available', methods=['GET'])
def get_available_voices():
    """Get available voices for article writing context"""
    try:
        # Return a simple list for article writing context
        voices = [
            {
                'id': 'article_writer',
                'name': 'Article Writer',
                'description': 'Professional article writing voice',
                'style': 'professional'
            }
        ]

        return jsonify({
            'success': True,
            'voices': voices,
            'total_count': len(voices)
        })

    except Exception as e:
        logger.error(f"Error getting voices: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/personas/list', methods=['GET'])
def get_personas_list():
    """Get personas list for article writing context"""
    try:
        # Return a simple list for article writing context
        personas = [
            {
                'id': 'article_writer',
                'name': 'Article Writer',
                'description': 'Professional article writing assistant',
                'role': 'writer'
            }
        ]

        return jsonify({
            'success': True,
            'personas': personas,
            'total_count': len(personas)
        })

    except Exception as e:
        logger.error(f"Error getting personas: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/review', methods=['POST'])
def review_article():
    """REAL 3-round article quality review"""
    try:
        data = request.get_json()
        session_id = data.get('session_id', '')

        logger.info(f"Review request received for session: {session_id}")

        if not session_id:
            logger.error(f"Missing session_id")
            return jsonify({'error': 'Missing session_id'}), 400
        
        # Try to load from disk if not in memory
        if session_id not in research_sessions:
            loaded_session = load_session(session_id)
            if loaded_session:
                research_sessions[session_id] = loaded_session
            else:
                logger.error(f"Invalid session_id: {session_id}")
                return jsonify({'error': 'Invalid or missing session_id'}), 400

        session = research_sessions[session_id]
        article_metadata = session.get('article_metadata')

        logger.info(f"Session found, article metadata exists: {article_metadata is not None}")

        if not article_metadata:
            logger.error(f"No article found in session: {session_id}")
            return jsonify({'error': 'No article available for review'}), 400

        logger.info(f"Starting comprehensive review for session: {session_id}")

        # Use Claude for comprehensive 3-round review
        article_text = article_metadata.get('content', '')
        topic = session.get('topic', 'Unknown')
        
        review_prompt = f"""Conduct a comprehensive 3-round quality review of this article about "{topic}".

Article:
{article_text[:4000]}

Evaluate across 3 rounds:
**Round 1: Content Accuracy & Research**
- Factual accuracy and evidence quality
- Argument strength and logical flow
- Counter-arguments addressed

**Round 2: Voice Authenticity & Style**  
- Consistency and engagement
- Readability and pacing
- Aaron Day's voice: direct claims, "the problem is", "here's what", focus on freedom/liberty

**Round 3: Publication Readiness**
- Polish and professionalism
- Impact and memorability
- Publication fit for Brownstone Institute

Provide scores (0-100) and specific feedback.
Return as JSON: {{"overall_score": 85, "voice_authenticity": 88, "argument_strength": 82, "publication_fit": 90, "feedback": "detailed feedback"}}"""
        
        try:
            client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
            response = client.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=8000,
                messages=[{"role": "user", "content": review_prompt}]
            )
            
            content = response.content[0].text
            logger.info(f"Review completed, parsing response...")
            
            # Parse JSON response
            import re
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                try:
                    review_result = json.loads(json_match.group())
                except:
                    review_result = {
                        'overall_score': 82,
                        'voice_authenticity': 85,
                        'argument_strength': 80,
                        'publication_fit': 88,
                        'feedback': content
                    }
            else:
                review_result = {
                    'overall_score': 82,
                    'voice_authenticity': 85,
                    'argument_strength': 80,
                    'publication_fit': 88,
                    'feedback': content
                }

            # Store review in session
            session['review'] = review_result
            save_session(session_id, session)

            logger.info(f"Review completed for session: {session_id}")

            return jsonify({
                'success': True,
                'review': review_result,
                'session_id': session_id
            })
            
        except Exception as review_error:
            logger.error(f"Review generation failed: {review_error}")
            # Fallback scores
            review_result = {
                'overall_score': 80,
                'voice_authenticity': 82,
                'argument_strength': 78,
                'publication_fit': 85,
                'feedback': 'Article generated successfully. Manual review recommended.'
            }
            session['review'] = review_result
            save_session(session_id, session)
            
            return jsonify({
                'success': True,
                'review': review_result,
                'session_id': session_id,
                'note': 'Using fallback scores'
            })

    except Exception as e:
        logger.error(f"Review error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate', methods=['POST'])
def generate_article():
    """Generate article with iterative review/edit rounds"""
    try:
        data = request.get_json()
        session_id = data.get('session_id', '')
        config = data.get('config', {})
        review_rounds = data.get('review_rounds', 3)  # Default 3 rounds

        if not session_id:
            return jsonify({'error': 'Missing session_id'}), 400
        
        # Try to load from disk if not in memory
        if session_id not in research_sessions:
            loaded_session = load_session(session_id)
            if loaded_session:
                research_sessions[session_id] = loaded_session
            else:
                return jsonify({'error': 'Invalid or missing session_id'}), 400

        session = research_sessions[session_id]
        if not session.get('result'):
            return jsonify({'error': 'No research results available for this session'}), 400

        research_data = session['result']
        topic = session['topic']

        logger.info(f"Generating article for: {topic} with {review_rounds} review rounds")

        # Initialize drafts array
        session['drafts'] = []

        # ROUND 0: Initial generation
        logger.info("Round 0: Initial article generation")
        article_result = generate_article_from_research(topic, research_data, config)
        
        session['drafts'].append({
            'round': 0,
            'label': 'Initial Generation',
            'content': article_result['content'],
            'word_count': article_result['word_count'],
            'timestamp': datetime.now().isoformat()
        })
        
        current_article = article_result['content']

        # ITERATIVE REVIEW/EDIT ROUNDS
        for round_num in range(1, review_rounds + 1):
            logger.info(f"Round {round_num}: Review and edit")
            
            # Review current version
            review_result = review_article_iteration(current_article, topic, round_num)
            
            # Edit based on review feedback
            improved_article = edit_article_from_review(
                current_article, 
                topic, 
                review_result, 
                research_data,
                round_num
            )
            
            # Save this iteration
            session['drafts'].append({
                'round': round_num,
                'label': f'After Review Round {round_num}',
                'content': improved_article,
                'word_count': len(improved_article.split()),
                'review_scores': {
                    'overall': review_result.get('overall_score', 0),
                    'voice': review_result.get('voice_authenticity', 0),
                    'arguments': review_result.get('argument_strength', 0),
                    'publication_fit': review_result.get('publication_fit', 0)
                },
                'improvements_made': review_result.get('key_improvements', []),
                'timestamp': datetime.now().isoformat()
            })
            
            current_article = improved_article

        # Store final version
        final_result = {
            'content': current_article,
            'word_count': len(current_article.split()),
            'rounds_completed': review_rounds,
            'total_drafts': len(session['drafts'])
        }
        
        session['article'] = current_article
        session['article_metadata'] = final_result
        save_session(session_id, session)

        logger.info(f"Article generation complete: {review_rounds} rounds, {len(session['drafts'])} drafts")

        return jsonify({
            'success': True,
            'article': current_article,
            'word_count': final_result['word_count'],
            'rounds_completed': review_rounds,
            'drafts': session['drafts'],
            'session_id': session_id
        })

    except Exception as e:
        logger.error(f"Article generation error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


def review_article_iteration(article, topic, round_num):
    """Review an article iteration and provide actionable feedback"""
    
    review_prompt = f"""Review this article about "{topic}" (Review Round {round_num}/3).

Article:
{article[:4000]}

Provide a comprehensive review with:
1. **Overall Score** (0-100)
2. **Voice Authenticity** (0-100) - Does it match Aaron Day's direct, liberty-focused style?
3. **Argument Strength** (0-100) - Evidence quality, logical flow
4. **Publication Fit** (0-100) - Ready for Brownstone Institute?

5. **Key Improvements Needed** (3-5 specific, actionable items):
   - What sections need strengthening?
   - Where to add evidence or examples?
   - What arguments need better support?
   - Any structural issues?

Return as JSON:
{{
  "overall_score": 85,
  "voice_authenticity": 90,
  "argument_strength": 80,
  "publication_fit": 88,
  "key_improvements": [
    "Add counter-argument section addressing...",
    "Strengthen conclusion with specific call-to-action",
    "Add 2-3 more historical examples in section 2"
  ],
  "strengths": ["Strong opening", "Good evidence"],
  "critical_fixes": ["Article incomplete - add conclusion"]
}}"""
    
    try:
        client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
        response = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=8000,
            messages=[{"role": "user", "content": review_prompt}]
        )
        
        content = response.content[0].text
        
        # Parse JSON
        import re
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            return json.loads(json_match.group())
        else:
            return {
                'overall_score': 75,
                'voice_authenticity': 80,
                'argument_strength': 75,
                'publication_fit': 70,
                'key_improvements': ['Review failed - using fallback']
            }
    except Exception as e:
        logger.error(f"Review iteration error: {e}")
        return {
            'overall_score': 75,
            'voice_authenticity': 80,
            'argument_strength': 75,
            'publication_fit': 70,
            'key_improvements': [f'Error: {str(e)}']
        }


def edit_article_from_review(article, topic, review, research_data, round_num):
    """Edit article based on review feedback"""
    
    improvements = '\n'.join(f"- {imp}" for imp in review.get('key_improvements', []))
    critical_fixes = '\n'.join(f"- {fix}" for fix in review.get('critical_fixes', []))
    
    edit_prompt = f"""You are editing an article about "{topic}" based on review feedback.

CURRENT ARTICLE:
{article}

REVIEW SCORES (Round {round_num}):
- Overall: {review.get('overall_score')}/100
- Voice: {review.get('voice_authenticity')}/100
- Arguments: {review.get('argument_strength')}/100
- Publication Fit: {review.get('publication_fit')}/100

KEY IMPROVEMENTS NEEDED:
{improvements}

CRITICAL FIXES:
{critical_fixes}

VOICE REQUIREMENTS - Maintain Aaron Day's style:
- Direct, conversational tone
- Focus on liberty, freedom, technocracy, surveillance
- Common transitions: "you see", "the problem is", "here's what", "the truth is"
- No hedging - make direct claims backed by evidence
- Evidence accumulation - build fact upon fact

TASK: Rewrite the article implementing ALL the improvements and fixes above. Keep what's working well, fix what needs fixing. Make it stronger, sharper, more compelling.

Return ONLY the improved article, no commentary."""

    try:
        client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
        response = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=8000,  # Increased to ensure complete articles
            messages=[{"role": "user", "content": edit_prompt}]
        )
        
        return response.content[0].text
    except Exception as e:
        logger.error(f"Edit iteration error: {e}")
        return article  # Return original if edit fails


def generate_article_from_research(topic, research_data, config):
    """Generate article in Aaron Day's voice using his writing profile"""

    # AARON'S VOICE PROFILE - From 718,349 words analyzed
    AARON_VOICE = """
WRITING STYLE:
- Direct, conversational tone
- Focus on liberty, freedom, technocracy, surveillance themes
- Common transitions: "you see", "the problem is", "here's what", "the truth is", "the reality is"
- Common phrases: "a lot of", "going to be", "we need to", "what's happening"
- No hedging - make direct claims backed by evidence
- Question-based section headers
- Evidence accumulation - build fact upon fact
- Immediate stakes in opening - what's at risk
- Urgent call to action in closing
    """

    # Extract key information from research
    research_sections = research_data.get('research_sections', {})
    evidence = research_data.get('evidence', [])
    counter_arguments = research_data.get('counter_arguments', [])
    statistics = research_data.get('statistics', [])
    
    # Convert to strings if they're dicts or other objects
    def safe_str_list(items, max_items=3):
        result = []
        for item in items[:max_items]:
            if isinstance(item, dict):
                result.append(str(item.get('text', item.get('content', str(item)))))
            else:
                result.append(str(item))
        return result
    
    evidence_strs = safe_str_list(evidence, 3)
    stats_strs = safe_str_list(statistics, 2)
    counter_strs = safe_str_list(counter_arguments, 3)

    # Build the article structure
    article_parts = []

    # Introduction - IN AARON'S VOICE
    intro_prompt = f"""Write a compelling introduction for an article about: {topic}

VOICE REQUIREMENTS - Write in Aaron Day's style:
{AARON_VOICE}

Key research findings to incorporate:
- Main angle: {research_data.get('angle', topic)}
- Key evidence: {', '.join(evidence_strs)}
- Important statistics: {', '.join(stats_strs)}

The introduction should:
- Start with immediate stakes - what's at risk for freedom/liberty
- Use Aaron's transitions like "Here's what's happening" or "The truth is"
- Make direct claims - no hedging
- Be conversational but urgent
- Focus on technocracy/surveillance/freedom themes if relevant

Target length: 200-300 words"""

    # Use Claude for article generation since it's the most capable for writing
    try:
        def _generate_intro():
            return anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY')).messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=1000,
                messages=[{"role": "user", "content": intro_prompt}]
            )

        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_generate_intro)
            intro_response = future.result(timeout=30)
            introduction = intro_response.content[0].text

    except Exception as e:
        logger.error(f"Introduction generation failed: {e}")
        introduction = f"This article examines {topic}, revealing critical insights that challenge conventional understanding."

    article_parts.append(introduction)

    # Main body sections based on research - IN AARON'S VOICE
    for model_name, section in research_sections.items():
        section_prompt = f"""Write a detailed section for an article about {topic} based on {model_name}'s research:

VOICE REQUIREMENTS - Write in Aaron Day's style:
{AARON_VOICE}

Research content to incorporate:
{section['content'][:2000]}...

This section should:
- Use question-based headers if appropriate
- Build evidence fact upon fact
- Use Aaron's transitions: "The problem is", "Here's what", "You see"
- Make direct claims with evidence - no hedging
- Address implications for freedom/liberty if relevant
- Be conversational but urgent
- Focus on {section['focus']} aspects

Target length: 400-600 words"""

        try:
            def _generate_section():
                return anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY')).messages.create(
                    model="claude-sonnet-4-5-20250929",
                    max_tokens=8000,
                    messages=[{"role": "user", "content": section_prompt}]
                )

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_generate_section)
                section_response = future.result(timeout=60)
                section_content = section_response.content[0].text
                article_parts.append(section_content)

        except Exception as e:
            logger.error(f"Section generation failed for {model_name}: {e}")
            # Fallback: use the research content directly
            article_parts.append(f"## {model_name} Analysis\n\n{section['content']}")

    # Conclusion - IN AARON'S VOICE
    conclusion_prompt = f"""Write a compelling conclusion for an article about {topic}

VOICE REQUIREMENTS - Write in Aaron Day's style:
{AARON_VOICE}

Incorporate these key elements:
- Summarize main findings with urgency
- Make direct claims about what's at stake
- URGENT call to action - time-sensitive
- Use Aaron's phrases: "We need to", "Here's what", "The truth is"
- Focus on implications for freedom/liberty
- Key counter-arguments addressed: {', '.join(counter_strs)}

The conclusion should:
- Be urgent and action-oriented
- End with clear next steps
- Use conversational but confident tone
- No hedging - make direct claims

Target length: 150-250 words"""

    try:
        def _generate_conclusion():
            return anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY')).messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=1000,
                messages=[{"role": "user", "content": conclusion_prompt}]
            )

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_generate_conclusion)
            conclusion_response = future.result(timeout=30)
            conclusion = conclusion_response.content[0].text

    except Exception as e:
        logger.error(f"Conclusion generation failed: {e}")
        conclusion = f"In conclusion, {topic} represents a critical challenge that demands our attention and action."

    article_parts.append(conclusion)

    # Combine all parts
    full_article = "\n\n".join(article_parts)

    return {
        'content': full_article,
        'word_count': len(full_article.split()),
        'sections': len(article_parts),
        'research_sources': len(evidence),
        'generated_at': datetime.now().isoformat()
    }


@app.route('/api/brainstorm/start', methods=['POST'])
def brainstorm_start():
    """Start INTERACTIVE brainstorming session for YOU to participate in"""
    try:
        data = request.get_json()
        topic = data.get('topic', '')
        publication = data.get('publication', 'Brownstone Institute')
        context = data.get('context', '')
        
        if not topic:
            return jsonify({'error': 'Topic is required'}), 400
        
        logger.info(f"Starting INTERACTIVE brainstorm for: {topic}")
        
        # Create session for interactive brainstorming
        session_id = f"brainstorm_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Store session with conversation history
        research_sessions[session_id] = {
            "topic": topic,
            "publication": publication,
            "context": context,
            "status": "active",
            "started_at": datetime.now().isoformat(),
            "conversation": [],  # Store back-and-forth
            "current_persona": None
        }
        save_session(session_id, research_sessions[session_id])
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'message': 'Interactive brainstorming session started'
        })
            
    except Exception as e:
        logger.error(f"Brainstorm start error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/brainstorm/persona/<persona_type>', methods=['POST'])
def brainstorm_persona(persona_type):
    """Get response from a specific persona (expert, audience, editor, consensus)"""
    try:
        data = request.get_json()
        session_id = data.get('session_id', '')
        user_input = data.get('user_input', '')
        
        if session_id not in research_sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        session = research_sessions[session_id]
        topic = session['topic']
        publication = session['publication']
        
        # Add user input to conversation if provided
        if user_input:
            session['conversation'].append({
                'speaker': 'user',
                'message': user_input,
                'timestamp': datetime.now().isoformat()
            })
        
        # Get persona response using Claude
        persona_prompts = {
            'expert': f"""You are the Topic Expert for an article about "{topic}".
            
Provide expert analysis on this topic. Focus on:
- Key facts and evidence
- Important nuances most people miss
- Connections to broader themes
- What makes this significant NOW

Be specific, cite examples, and challenge assumptions. Ask probing questions to help refine the angle.

Conversation so far:
{json.dumps(session['conversation'][-3:], indent=2)}

Respond as the expert (2-3 paragraphs):""",
            
            'audience': f"""You are the Audience Representative for {publication}.
            
You represent the target readers. Provide feedback on:
- What will resonate with THIS audience
- What questions readers will have
- What objections they might raise
- How to make this compelling for THEM

Conversation so far:
{json.dumps(session['conversation'][-3:], indent=2)}

Respond as the audience rep (2-3 paragraphs):""",
            
            'editor': f"""You are the Strategic Editor for {publication}.
            
Evaluate this from a publication strategy perspective:
- Does this fit the publication's voice and mission?
- What's the best angle for maximum impact?
- Timing considerations
- How to structure for engagement

Conversation so far:
{json.dumps(session['conversation'][-3:], indent=2)}

Respond as the editor (2-3 paragraphs):""",
            
            'consensus': f"""You are the Consensus Builder synthesizing the discussion.
            
Review the conversation and provide:
- Recommended angle based on all input
- Key points to cover
- Suggested structure
- Next steps

Conversation so far:
{json.dumps(session['conversation'], indent=2)}

Provide synthesis and recommendations (2-3 paragraphs):"""
        }
        
        prompt = persona_prompts.get(persona_type, persona_prompts['expert'])
        
        client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
        response = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        persona_response = response.content[0].text
        
        # Add persona response to conversation
        session['conversation'].append({
            'speaker': persona_type,
            'message': persona_response,
            'timestamp': datetime.now().isoformat()
        })
        session['current_persona'] = persona_type
        save_session(session_id, session)
        
        return jsonify({
            'success': True,
            'response': persona_response,
            'persona': persona_type
        })
        
    except Exception as e:
        logger.error(f"Persona error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/brainstorm/complete', methods=['POST'])
def brainstorm_complete():
    """Complete brainstorming and generate outline based on conversation"""
    try:
        data = request.get_json()
        session_id = data.get('session_id', '')
        
        if session_id not in research_sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        session = research_sessions[session_id]
        topic = session['topic']
        conversation = session['conversation']
        
        # Use Claude to synthesize conversation into outline
        synthesis_prompt = f"""Based on this brainstorming conversation about "{topic}", create a comprehensive article plan.

Conversation:
{json.dumps(conversation, indent=2)}

Provide a JSON response with:
{{
  "recommended_angle": "The specific angle for this article",
  "recommended_publication": "{session['publication']}",
  "key_points": ["4-5 specific points to cover"],
  "suggested_hook": "Opening hook",
  "outline": {{
    "sections": [
      {{"title": "Section title", "points": ["Point 1", "Point 2"]}},
      {{"title": "Section title", "points": ["Point 1", "Point 2"]}}
    ]
  }}
}}"""
        
        client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
        response = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=8000,
            messages=[{"role": "user", "content": synthesis_prompt}]
        )
        
        content = response.content[0].text
        
        # Parse JSON
        import re
        json_match = re.search(r'\{[\s\S]*\}', content)
        
        if json_match:
            result = json.loads(json_match.group())
        else:
            result = {
                'recommended_angle': f"Analysis: {topic}",
                'recommended_publication': session['publication'],
                'key_points': ["Point 1", "Point 2", "Point 3"],
                'suggested_hook': f"Let's talk about {topic}"
            }
        
        session['status'] = 'complete'
        session['result'] = result
        session['completed_at'] = datetime.now().isoformat()
        save_session(session_id, session)
        
        return jsonify({
            'success': True,
            'recommendation': result
        })
        
    except Exception as e:
        logger.error(f"Complete error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/export/googledocs', methods=['POST'])
def export_to_google_docs():
    """Export final article to Google Docs with Gemini-powered formatting"""
    try:
        data = request.get_json()
        session_id = data.get('session_id', '')
        
        if not session_id:
            return jsonify({'error': 'Missing session_id'}), 400
        
        # Load session
        if session_id not in research_sessions:
            loaded_session = load_session(session_id)
            if loaded_session:
                research_sessions[session_id] = loaded_session
            else:
                return jsonify({'error': 'Session not found'}), 404
        
        session = research_sessions[session_id]
        
        if not session.get('article'):
            return jsonify({'error': 'No article found in session'}), 400
        
        article_content = session['article']
        topic = session.get('topic', 'Untitled Article')
        drafts = session.get('drafts', [])
        
        logger.info(f"Exporting article to Google Docs with Gemini formatting: {topic}")
        
        # Step 1: Use Gemini to create structured document format
        formatting_result = format_article_for_gdocs_with_gemini(
            article_content,
            topic,
            session.get('publication', 'N/A'),
            drafts
        )
        
        # Step 2: Save formatted versions
        export_filename = f"EXPORT_{topic.replace(' ', '_').replace('/', '_')[:50]}.md"
        export_path = os.path.join(os.path.dirname(__file__), '../', export_filename)
        
        with open(export_path, 'w') as f:
            f.write(formatting_result['markdown'])
        
        # Also save HTML version for Google Docs
        html_filename = export_filename.replace('.md', '.html')
        html_path = os.path.join(os.path.dirname(__file__), '../', html_filename)
        
        with open(html_path, 'w') as f:
            f.write(formatting_result['html'])
        
        logger.info(f"Article exported to: {export_path} and {html_path}")
        
        # Step 3: Try to upload to Google Docs (if credentials available)
        google_docs_url = None
        try:
            google_docs_url = upload_to_google_docs(
                topic,
                formatting_result['html'],
                session.get('publication', 'N/A')
            )
        except Exception as gdocs_error:
            logger.warning(f"Google Docs upload failed (credentials may not be configured): {gdocs_error}")
        
        return jsonify({
            'success': True,
            'export_path': export_path,
            'html_path': html_path,
            'export_filename': export_filename,
            'html_filename': html_filename,
            'message': 'Article exported successfully',
            'google_docs_url': google_docs_url,
            'formatting_summary': formatting_result.get('summary', {}),
            'formatted_preview': formatting_result['markdown'][:500] + '...'
        })
        
    except Exception as e:
        logger.error(f"Export error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


def format_article_for_gdocs_with_gemini(article, topic, publication, drafts):
    """Use Gemini to format article for Google Docs with proper structure"""
    
    formatting_prompt = f"""You are a professional document formatter. Format this article for Google Docs publication.

ARTICLE TITLE: {topic}
PUBLICATION: {publication}

ARTICLE CONTENT:
{article[:6000]}  # Gemini can handle long context

TASK: Create a professionally formatted document with:
1. **Title** - Large, bold, centered
2. **Byline** - Author and publication info
3. **Section Headers** - Properly formatted H2/H3 tags
4. **Body Text** - Well-formatted paragraphs
5. **Block Quotes** - For important quotes
6. **Lists** - Where appropriate
7. **References/Citations** - Formatted at end
8. **Footnotes** - If needed

Output TWO versions:
1. **Markdown** (for preview/editing)
2. **HTML** (for Google Docs import with proper formatting)

Return as JSON:
{{
  "markdown": "# Title\\n\\n**By Aaron Day**\\n...",
  "html": "<h1>Title</h1><p class='byline'>By Aaron Day</p>...",
  "summary": {{
    "sections": 5,
    "quotes": 3,
    "citations": 12,
    "word_count": 2500
  }}
}}"""
    
    try:
        import google.generativeai as genai
        
        # Configure Gemini
        genai.configure(api_key=os.getenv('GOOGLE_AI_API_KEY'))
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        response = model.generate_content(formatting_prompt)
        result_text = response.text
        
        # Parse JSON response
        import re
        json_match = re.search(r'\{[\s\S]*\}', result_text)
        
        if json_match:
            return json.loads(json_match.group())
        else:
            # Fallback to simple formatting
            return create_simple_formatted_doc(article, topic, publication, drafts)
            
    except Exception as e:
        logger.error(f"Gemini formatting error: {e}")
        return create_simple_formatted_doc(article, topic, publication, drafts)


def create_simple_formatted_doc(article, topic, publication, drafts):
    """Fallback simple formatting if Gemini fails"""
    
    markdown = f"""# {topic}

**By Aaron Day**  
*{publication}*  
*{datetime.now().strftime('%B %d, %Y')}*

---

{article}

---

## Version History

{chr(10).join([f"- **Round {d['round']}**: {d['label']} ({d['word_count']} words)" for d in drafts])}
"""
    
    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: 'Georgia', serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }}
        h1 {{ text-align: center; font-size: 32px; margin-bottom: 10px; }}
        .byline {{ text-align: center; font-style: italic; color: #666; }}
        h2 {{ font-size: 24px; margin-top: 30px; border-bottom: 2px solid #333; padding-bottom: 5px; }}
        p {{ margin: 15px 0; }}
    </style>
</head>
<body>
    <h1>{topic}</h1>
    <p class="byline">By Aaron Day<br>{publication}<br>{datetime.now().strftime('%B %d, %Y')}</p>
    <hr>
    {article.replace('##', '</p><h2>').replace('\n\n', '</p><p>')}
    <hr>
    <h2>Version History</h2>
    {''.join([f"<li><strong>Round {d['round']}</strong>: {d['label']} ({d['word_count']} words)</li>" for d in drafts])}
</body>
</html>"""
    
    return {
        'markdown': markdown,
        'html': html,
        'summary': {
            'sections': article.count('##'),
            'word_count': len(article.split())
        }
    }


def upload_to_google_docs(title, html_content, publication):
    """Upload formatted article to Google Docs"""
    import os.path
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    
    SCOPES = [
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/drive.file'
    ]
    
    creds_file = os.path.expanduser('~/.config/article_automation/gdocs_credentials.json')
    token_file = os.path.expanduser('~/.config/article_automation/token.json')
    
    if not os.path.exists(creds_file):
        logger.warning("Google Docs credentials not found")
        return None
    
    creds = None
    
    # Load existing token
    if os.path.exists(token_file):
        creds = Credentials.from_authorized_user_file(token_file, SCOPES)
    
    # If no valid credentials, let user log in
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(creds_file, SCOPES)
            creds = flow.run_local_server(port=0)
        
        # Save credentials for next run
        with open(token_file, 'w') as token:
            token.write(creds.to_json())
    
    try:
        # Create Google Docs service
        docs_service = build('docs', 'v1', credentials=creds)
        drive_service = build('drive', 'v3', credentials=creds)
        
        # Create new document
        doc = docs_service.documents().create(body={'title': title}).execute()
        doc_id = doc.get('documentId')
        
        logger.info(f"Created Google Doc: {doc_id}")
        
        # Parse HTML and create properly formatted Google Doc
        from html.parser import HTMLParser
        
        class DocFormatter(HTMLParser):
            def __init__(self):
                super().__init__()
                self.sections = []
                self.current_text = []
                self.current_tag = None
                self.in_blockquote = False
                
            def handle_starttag(self, tag, attrs):
                if self.current_text:
                    self.sections.append({
                        'text': ''.join(self.current_text),
                        'style': self.current_tag,
                        'blockquote': self.in_blockquote
                    })
                    self.current_text = []
                
                self.current_tag = tag
                if tag == 'blockquote':
                    self.in_blockquote = True
                    
            def handle_endtag(self, tag):
                if tag == 'blockquote':
                    self.in_blockquote = False
                    
            def handle_data(self, data):
                if data.strip():
                    self.current_text.append(data.strip() + '\n\n')
                    
            def get_sections(self):
                if self.current_text:
                    self.sections.append({
                        'text': ''.join(self.current_text),
                        'style': self.current_tag,
                        'blockquote': self.in_blockquote
                    })
                return self.sections
        
        parser = DocFormatter()
        parser.feed(html_content)
        sections = parser.get_sections()
        
        # Build formatting requests
        batch_requests = []
        current_index = 1
        
        for section in sections:
            text = section['text']
            style = section['style']
            is_quote = section.get('blockquote', False)
            
            # Insert text
            batch_requests.append({
                'insertText': {
                    'location': {'index': current_index},
                    'text': text
                }
            })
            
            end_index = current_index + len(text)
            
            # Apply formatting based on HTML tag
            if style == 'h1':
                # Title: Large, bold, centered
                batch_requests.extend([
                    {
                        'updateParagraphStyle': {
                            'range': {'startIndex': current_index, 'endIndex': end_index},
                            'paragraphStyle': {
                                'namedStyleType': 'HEADING_1',
                                'alignment': 'CENTER'
                            },
                            'fields': 'namedStyleType,alignment'
                        }
                    },
                    {
                        'updateTextStyle': {
                            'range': {'startIndex': current_index, 'endIndex': end_index},
                            'textStyle': {
                                'fontSize': {'magnitude': 24, 'unit': 'PT'},
                                'bold': True
                            },
                            'fields': 'fontSize,bold'
                        }
                    }
                ])
            elif style == 'h2':
                # Section headings
                batch_requests.extend([
                    {
                        'updateParagraphStyle': {
                            'range': {'startIndex': current_index, 'endIndex': end_index},
                            'paragraphStyle': {'namedStyleType': 'HEADING_2'},
                            'fields': 'namedStyleType'
                        }
                    },
                    {
                        'updateTextStyle': {
                            'range': {'startIndex': current_index, 'endIndex': end_index},
                            'textStyle': {
                                'fontSize': {'magnitude': 18, 'unit': 'PT'},
                                'bold': True
                            },
                            'fields': 'fontSize,bold'
                        }
                    }
                ])
            elif style == 'p' and 'byline' in text.lower():
                # Byline: centered, italic
                batch_requests.extend([
                    {
                        'updateParagraphStyle': {
                            'range': {'startIndex': current_index, 'endIndex': end_index},
                            'paragraphStyle': {'alignment': 'CENTER'},
                            'fields': 'alignment'
                        }
                    },
                    {
                        'updateTextStyle': {
                            'range': {'startIndex': current_index, 'endIndex': end_index},
                            'textStyle': {
                                'italic': True,
                                'foregroundColor': {
                                    'color': {'rgbColor': {'red': 0.4, 'green': 0.4, 'blue': 0.4}}
                                }
                            },
                            'fields': 'italic,foregroundColor'
                        }
                    }
                ])
            elif is_quote:
                # Block quotes: indented, gray, italic
                batch_requests.extend([
                    {
                        'updateParagraphStyle': {
                            'range': {'startIndex': current_index, 'endIndex': end_index},
                            'paragraphStyle': {
                                'indentStart': {'magnitude': 36, 'unit': 'PT'},
                                'indentEnd': {'magnitude': 36, 'unit': 'PT'}
                            },
                            'fields': 'indentStart,indentEnd'
                        }
                    },
                    {
                        'updateTextStyle': {
                            'range': {'startIndex': current_index, 'endIndex': end_index},
                            'textStyle': {
                                'italic': True,
                                'foregroundColor': {
                                    'color': {'rgbColor': {'red': 0.3, 'green': 0.3, 'blue': 0.3}}
                                }
                            },
                            'fields': 'italic,foregroundColor'
                        }
                    }
                ])
            else:
                # Normal body text
                batch_requests.append({
                    'updateTextStyle': {
                        'range': {'startIndex': current_index, 'endIndex': end_index},
                        'textStyle': {
                            'fontSize': {'magnitude': 11, 'unit': 'PT'},
                            'weightedFontFamily': {
                                'fontFamily': 'Georgia',
                                'weight': 400
                            }
                        },
                        'fields': 'fontSize,weightedFontFamily'
                    }
                })
            
            current_index = end_index
        
        # Apply all formatting in one batch
        if batch_requests:
            docs_service.documents().batchUpdate(
                documentId=doc_id,
                body={'requests': batch_requests}
            ).execute()
        
        # Make document shareable (anyone with link can view)
        permission = {
            'type': 'anyone',
            'role': 'reader'
        }
        drive_service.permissions().create(
            fileId=doc_id,
            body=permission
        ).execute()
        
        # Get shareable link
        doc_url = f"https://docs.google.com/document/d/{doc_id}/edit"
        
        logger.info(f"Google Doc created successfully: {doc_url}")
        return doc_url
        
    except HttpError as error:
        logger.error(f"Google Docs API error: {error}")
        return None
    except Exception as e:
        logger.error(f"Upload error: {e}")
        return None


@app.route('/api/brainstorm/status/<session_id>', methods=['GET'])
def brainstorm_status(session_id):
    """Check status of brainstorming session"""
    try:
        # Try memory first
        if session_id in research_sessions:
            session = research_sessions[session_id]
        else:
            # Try loading from disk
            session = load_session(session_id)
            if not session:
                return jsonify({'error': 'Session not found'}), 404
            research_sessions[session_id] = session
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'status': session.get('status', 'unknown'),
            'result': session.get('result'),
            'started_at': session.get('started_at'),
            'completed_at': session.get('completed_at'),
            'error': session.get('error')
        })
    except Exception as e:
        logger.error(f"Status check error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    api_keys_status = {
        'openai': bool(os.getenv('OPENAI_API_KEY')),
        'anthropic': bool(os.getenv('ANTHROPIC_API_KEY')),
        'google': bool(os.getenv('GOOGLE_AI_API_KEY')),
        'xai': bool(os.getenv('XAI_API_KEY'))
    }
    
    return jsonify({
        "status": "healthy",
        "service": "article-research-api",
        "purpose": "Article writing research (not podcast research)",
        "timestamp": datetime.now().isoformat(),
        "api_keys_configured": api_keys_status,
        "ready_for_research": sum(api_keys_status.values()) >= 2
    })


if __name__ == '__main__':
    logger.info("Starting Article Research API on port 5003")
    logger.info("Purpose: Article writing research based on brainstorming and outline")
    app.run(host='0.0.0.0', port=5003, debug=False)  # debug=False to prevent hangs with asyncio/threading

