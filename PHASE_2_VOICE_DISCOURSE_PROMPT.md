# Phase 2: Build Customizable Voice Discourse System Using Claude 4 API

## Background: Phase 1 Complete ✅

### Project Overview
I'm building "The Aaron Day Show" - a complete automated podcast production system. Phase 1 (Research & Content Generation) is now FULLY OPERATIONAL with:
- ✅ 4-model AI research system (Claude 4 Sonnet, GPT-4 Turbo, Gemini Pro Latest, Grok 4 Fast)
- ✅ Research reports dashboard integration (localhost:3000)
- ✅ Flask API server with research endpoints (localhost:5003)
- ✅ Comprehensive test suite passing for all AI models
- ✅ Production site deployed with Owncast/livestreaming (theaarondayshow.com)

### Current System Architecture
```
/Users/aaronday/aaron-day-show-podcast-automation/
├── dashboard/
│   ├── api_server.py ✅ (Running on port 5003)
│   └── start_dashboard_server.py ✅
├── research/
│   ├── aggregator.py ✅ (4-model AI integration)
│   ├── report_generator.py ✅
│   └── source_tracker.py ✅
├── utils/
│   └── api_manager.py ✅ (Claude 4, GPT-4, Gemini, Grok APIs)
├── discourse/
│   └── voice_engine.py ⚠️ (EXISTS but needs Claude 4 integration)
├── content/
│   └── meme_generator.py ✅
├── .env ✅ (All API keys configured)
├── requirements.txt ✅
└── venv/ ✅ (Active virtual environment)
```

### Working API Keys (Configured in `.env`)
- `ANTHROPIC_API_KEY` - Claude 4 Sonnet (claude-4-sonnet-20250514)
- `OPENAI_API_KEY` - GPT-4 Turbo
- `GOOGLE_AI_API_KEY` - Gemini Pro Latest
- `XAI_API_KEY` - Grok 4 Fast

### System Status Documents
For full context on what we've built, see:
- `Dashboard_Start.MD` - Master automation dashboard showing all systems
- `aaron-day-show-automation.md` - Complete implementation guide
- Latest update: September 30, 2025 - Overall Ecosystem Status: 🚀 PRODUCTION READY (100%) 🚀

---

## Phase 2: Voice Discourse System - YOUR TASK

### Context & Goal
Phase 2 builds the VOICE DISCOURSE SYSTEM that will generate 30-45 minute podcast segments. User speaks their thoughts, and 3 customizable AI personas (all powered by Claude 4 API) challenge them from different perspectives, creating natural debate-style content.

**This is NOT just chatbot conversation - this is DEBATE TRAINING and CONTENT GENERATION.**

### Working Directory
`~/aaron-day-show-podcast-automation/discourse/`

### Critical Requirements

#### 1. **Full Customizability**
- User can define their own personas (not hardcoded)
- Each persona has: name, role, perspective, style, knowledge areas, argument patterns, voice settings
- Personas saved to `personas.json` for reuse
- Option to use default personas OR create custom ones per session

#### 2. **Claude 4 API Integration**
- ALL persona responses use Claude 4 API (`claude-4-sonnet-20250514` or `claude-opus-4-1-20250805` if available)
- Each persona maintains consistent character throughout 30-45 minute session
- Context-aware responses (personas react to what user said AND what other personas said)
- Temperature control per persona (default 0.8)

#### 3. **Full Voice Interaction**
- **Speech-to-Text:** User speaks naturally (no typing), system transcribes using Whisper
- **Text-to-Speech:** Persona responses spoken aloud with unique voice settings per persona
- 30-45 minute natural conversations with back-and-forth exchanges
- Complete transcript saved as JSON

#### 4. **Intelligent Discourse Flow**
- Personas challenge user from their unique perspectives
- No easy agreement - personas push back and expose weak arguments
- Extract key insights, strongest arguments, weakest points from session
- Generate actionable takeaways

### Implementation Tasks

#### Task 1: Create `discourse/persona_manager.py`
A class to create, save, load, and manage customizable personas:

**Features:**
- `PersonaManager` class with `personas.json` persistence
- `Persona` dataclass with fields:
  - name, role, perspective, style
  - knowledge_areas (List[str])
  - argument_patterns (List[str])
  - challenges_from (what position they argue from)
  - voice_profile (Dict with TTS settings)
  - temperature (float, default 0.8)
- `create_persona()` - Interactive CLI persona creation
- `get_default_personas()` - Returns 3 default personas:
  1. **Technocrat** (Pro-surveillance, WEF/BlackRock advocate)
  2. **Purist** (Anarchist/voluntaryist, anti-state absolutist)
  3. **Strategist** (Pragmatic analyst, seeks synthesis)
- `save_personas()` / `load_personas()` - JSON persistence

#### Task 2: Create `discourse/claude_discourse_engine.py`
The main engine that runs voice discourse sessions:

**Features:**
- `ClaudeDiscourseEngine` class
- Integrates with existing `VoiceEngine` (already exists at `discourse/voice_engine.py`)
- `setup_session(topic)` - Choose custom or default personas
- `generate_persona_response(persona, context, user_statement)` 
  - Calls Claude 4 API with persona's full character definition
  - Includes recent conversation context (last 6 exchanges)
  - Returns in-character response (2-3 sentences for natural flow)
- `run_voice_session(topic, duration_minutes, research_context=None)`
  - Full voice interaction loop
  - User speaks → Transcribe → Each persona responds (via Claude 4) → Speak response → Repeat
  - Runs for specified duration (30-45 minutes)
  - Returns complete transcript + insights
- `extract_insights()` - Use Claude 4 to analyze transcript and extract:
  - Strongest arguments made
  - Weakest points exposed
  - Unexpected connections revealed
  - Best analogies or reframings
  - Practical action items

#### Task 3: Create `test_claude_discourse.py`
Test script to verify everything works:

**Features:**
- Interactive test: Ask for topic, run 20-minute session
- Display persona setup (custom or default)
- Show real-time transcript during session
- Save complete session to JSON file: `discourse_<topic>_<timestamp>.json`
- Display top 5 insights at end
- Verify Claude 4 API responses and voice interaction work correctly

### Technical Implementation Details

#### Existing Code to Integrate With
1. **`discourse/voice_engine.py`** - Already exists! This handles:
   - Whisper transcription (`listen_and_transcribe()`)
   - TTS speech generation (`speak()`)
   - Audio recording/playback
   
   **You need to:** Use this existing class, don't rewrite it

2. **`utils/api_manager.py`** - Already has:
   - `call_anthropic(prompt, model="claude-4-sonnet-20250514")`
   - Proper error handling and retries
   
   **You need to:** Use this for all Claude 4 API calls

#### Claude 4 Prompt Engineering
For each persona response, the prompt should be:

```
You are {persona.name}, with the role: {persona.role}

Your perspective: {persona.perspective}
Your style: {persona.style}
Your knowledge areas: {', '.join(persona.knowledge_areas)}
Your argument patterns: {', '.join(persona.argument_patterns)}
You challenge from: {persona.challenges_from}

Recent conversation:
{last 6 exchanges from transcript}

The user just said: "{user_statement}"

Topic being discussed: {topic}

Respond in character. Challenge their position from your perspective. 
Be specific, use examples, and don't agree easily. Keep response to 2-3 sentences 
for natural conversation. Stay completely in character.
```

#### File Structure After Phase 2
```
discourse/
├── voice_engine.py ✅ (Already exists)
├── persona_manager.py 🆕 (YOU CREATE)
├── claude_discourse_engine.py 🆕 (YOU CREATE)
└── personas.json 🆕 (Created by persona_manager)

test_claude_discourse.py 🆕 (YOU CREATE, in root)
```

### Success Criteria

Your implementation is complete when:

- ✅ User can create custom personas OR use defaults
- ✅ All persona responses generated by Claude 4 API
- ✅ Full voice interaction (user speaks, personas speak back)
- ✅ 30-45 minute sessions run smoothly
- ✅ Personas maintain character throughout session
- ✅ Context-aware responses (personas react to conversation flow)
- ✅ Complete transcript saved with timestamps
- ✅ Valuable insights extracted automatically
- ✅ `test_claude_discourse.py` runs without errors
- ✅ Session output saved to JSON: `discourse_<topic>_<timestamp>.json`

### Example Session Flow

```
$ python test_claude_discourse.py

🎤 CLAUDE 4 VOICE DISCOURSE TEST
==================================================
Enter topic for discourse: "Trump's US Sovereign Fund proposal"

🎭 VOICE DISCOURSE SESSION SETUP
==================================================
Topic: Trump's US Sovereign Fund proposal

Use (D)efault personas or (C)reate custom ones? d

📋 Session Personas:
  • Viktor (WEF/BlackRock Advocate): Pro-surveillance, pro-control, technocratic
  • Lysander (Anarchist/Voluntaryist): Anti-state, pro-freedom absolutist  
  • Marcus (Strategic Analyst): Pattern recognition, practical solutions

Ready to begin voice discourse!

🎤 STARTING VOICE DISCOURSE
==================================================
[Marcus speaks]: "Welcome. I'm Marcus. Let's explore Trump's US Sovereign Fund proposal from multiple angles. What's your initial position on this?"

[User speaks]: "I think it's a Curtis Yarvin ploy to create a technocratic monarchy..."

[Viktor speaks via Claude 4]: "Actually, sovereign wealth funds are standard financial instruments. Norway, Singapore, and the UAE use them successfully. This is about smart resource management, not monarchy..."

[User responds]: "But when combined with Yarvin's ideas about unitary executive theory..."

[Lysander speaks via Claude 4]: "Any centralized fund is theft by another name. The state has no legitimate claim to manage capital. We should be building voluntary alternatives, not empowering technocrats..."

... [Session continues for 30-45 minutes]

✅ Session complete!
📄 Saved to: discourse_trump_sovereign_fund_20250930_153045.json
💡 Insights extracted: 12

🔍 Key Insights:
1. User's strongest argument: Constitutional concerns about concentration of executive power
2. Weakest point exposed: Conflating different policy mechanisms without clear evidence
3. Unexpected connection: Link between sovereign funds and surveillance capitalism
4. Best reframing: "It's not about the fund, it's about who controls the allocation"
5. Action item: Research the actual governance structure proposed, not just the concept
```

### Additional Context

**Hardware:** Mac Studio M3 Ultra (512GB RAM, plenty of resources for Whisper + TTS)

**Voice Models Already Installed:**
- Whisper Large (for transcription)
- Coqui XTTS v2 (for text-to-speech)

**Integration Points:**
- Phase 1 research reports can be passed as `research_context` parameter to `run_voice_session()`
- Future: These discourse transcripts will become podcast episode segments
- Future: Insights extracted will inform social media content generation

### Important Notes

1. **Don't Reinvent:** Use existing `discourse/voice_engine.py` and `utils/api_manager.py`
2. **API Keys:** Already configured in `.env`, just import and use
3. **Claude 4 Model:** Use `claude-4-sonnet-20250514` (verified working in Phase 1)
4. **Session Length:** Target 30-45 minutes, but make duration configurable
5. **Transcript Format:** JSON with speaker, text, timestamp for each entry
6. **Personas:** Default 3 personas provided, but system must support custom personas

### Questions to Resolve First

Before you start coding, please confirm:
1. Should personas respond sequentially (one after another) or should user choose which persona to engage with next?
2. Should there be "rounds" where all 3 personas respond before user speaks again, or continuous back-and-forth?
3. Do you want the system to automatically detect when user has stopped speaking, or should user press a key to finish their statement?
4. Should the test script ask for duration in minutes, or use a fixed 20-30 minute test?

### Getting Started

You have access to all the files in:
- `/Users/aaronday/aaron-day-show-podcast-automation/`

Start by:
1. Reading `discourse/voice_engine.py` to understand existing voice capabilities
2. Reading `utils/api_manager.py` to understand Claude 4 API integration
3. Creating `discourse/persona_manager.py` with full persona customization
4. Creating `discourse/claude_discourse_engine.py` with voice discourse loop
5. Creating `test_claude_discourse.py` to verify everything works

Let's build this! 🚀
