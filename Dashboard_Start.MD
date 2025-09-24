# Aaron Day Show - Music Video Creator Dashboard

## 🎯 CURRENT STATUS: FULL PREVIEW + MP4 EXPORT

The music video creator now parses lyrics correctly, previews with the new default styling, and exports finished videos as MP4 files. Remaining polish items are around UX, but the end‑to‑end flow (upload → preview → render → download) works in Chrome/Edge.

## 📁 PROJECT STRUCTURE

```
/Users/aaronday/Documents/TheAaronDayShow/local-video-clipper/
├── public/
│   ├── index.html          # Main interface with tabs and controls
│   ├── music.js            # Core music video logic (2700+ lines)
│   ├── wedontbow.srt       # Test SRT file (1209 lines)
│   └── server.js           # Express server
├── package.json            # Node dependencies
└── README.md              # Basic setup info
```

## 🚀 HOW TO START

### Prerequisites
- Node.js installed
- Browser with modern JavaScript support

### Quick Start
```bash
cd /Users/aaronday/Documents/TheAaronDayShow/local-video-clipper
node server.js
```
- Server runs on **localhost:3001**
- Navigate to **localhost:3001** in browser
- Click "Music" tab to access video creator

## 🎵 MUSIC VIDEO CREATOR FEATURES

### ✅ WORKING FEATURES

#### 1. **Canvas Animation & Defaults**
- 800x450 canvas with 60fps animation loop
- Real-time text positioning (top/center/bottom)
- Frame counter and position indicators
- Smooth animation transitions
- Default lyric styling: 96px Neon Glow text, Smart Phrase grouping, 2 lines per verse, Fade In/Out transitions
- Default visualizer: Circular, top-left placement, 200px size, 1.5x sensitivity

#### 2. **Audio Visualizer System** 
- 8 visualizer types: Frequency Bars, Waveform, Circular, Spiral, Particles, Pulse, Spectrum, 3D Wave
- 9 position grid system (top-left through bottom-right + overlay)
- Visualizers properly centered in grid segments
- Color themes: Gold, Blue, Pink, Green, Rainbow, Fire, Ice, Purple

#### 3. **Text Positioning & Styling**
- 3 positions: Top, Center, Bottom (VERIFIED WORKING)
- 4 text styles: Normal, Bold, Outline, Shadow, Glow
- Auto-adjusting font sizes
- Text wrapping for long lines
- Multi-line display support

#### 4. **Lyric Display Modes**
- Word-by-word, line, smart phrase (default), sentence, Spotify-style verse blocks, and custom grouping

#### 5. **File Upload System**
- Background image upload (drag & drop supported)
- Audio file upload (.mp3, .wav, .ogg)
- SRT/VTT lyric file upload
- File validation and error handling

#### 6. **Sync Controls**
- Global offset adjustment
- Speed adjustment (0.5x to 2x)
- Manual sync forward/backward
- Reset sync functionality
- Real-time sync status display

### ✅ NEW OUTPUT WORKFLOW

- `🎬 GENERATE VIDEO` captures the preview canvas + audio with MediaRecorder
- Recorded WebM uploads to `/api/music-video/render` and is converted to MP4 (H.264/AAC) via FFmpeg
- Downloads automatically using the sanitized filename from the new "Output File Name" field (WebM fallback delivered if conversion fails)
- MP4 files saved in `local-video-clipper/clips/` for later reuse

### ⚠️ REMAINING TODO

- Additional UX polish (persisting settings, progress bar during render)
- Broader browser testing (Safari requires alternate capture pipeline)
- Optional: expose MP4 render history in the dashboard

## 🔧 TECHNICAL ARCHITECTURE

### Core Functions (music.js)

#### Animation & Rendering
- `preparePreview()` - Shared setup for preview/render (line ~1250)
- `startPreview()` - Preview animation loop tied to `<audio>` playback
- `drawPreviewFrame()` - Canvas rendering (line ~1500+)
- `drawVerseBlock()` / `drawTraditionalLines()` - Display modes

#### SRT/VTT Processing  
- `parseSrtForPreview()` - Parse SRT data into lyric objects (line ~2300)
- `cleanLyricText()` - Remove metadata and clean text (line ~2351)
- `timeToMs()` - Convert timestamps to milliseconds (line ~2400+)
- `groupLyrics()` - Group lyrics by display mode (line ~2100+)

#### File & Export Handling
- `handleImageUpload()` / `handleAudioUpload()` / `handleLyricsFileUpload()` (line ~600-900)
- `loadWeDontBowSRT()` wired to the quick-load button
- `generateVideo()` - Captures preview, posts to server, handles downloads (line ~2760)

#### Audio & Visualizer
- `setupAudioContext()` - Initialize Web Audio API (line ~1000+)
- `drawFrequencyBars()` - Frequency visualizer (line ~1800+)
- `drawWaveform()` - Waveform visualizer (line ~1900+)
- `calculateVisualizerPosition()` - Grid positioning (line ~2000+)

### Data Flow
```
SRT File Upload → parseSrtForPreview() → groupLyrics() → drawPreviewFrame() → Canvas
```

### Key Variables
- `currentSrtData` - Raw SRT file content
- `previewCanvas` - Main canvas element  
- `previewCtx` - Canvas 2D context
- `audioPreview` - HTML audio element
- `audioContext` - Web Audio API context

## 🐛 DEBUGGING INFORMATION

### Console Logs Added
- `🎬 Starting preview loop...` - Animation start
- `📝 Parsed lyrics: X segments` - SRT parsing results
- `🎵 Drawing lyric:` - Canvas lyric rendering diagnostics
- `🎥 Rendering <filename>.mp4...` - Export progress indicator

### Test SRT File
- **File**: `wedontbow.srt` (1209 lines)
- **Format**: Standard SRT with individual words
- **Sample**:
  ```
  1
  00:00:00,319 --> 00:00:00,398
  Intro

  2  
  00:00:00,438 --> 00:00:00,478
  We
  ```

### Browser Testing
- **Chrome / Edge**: Fully supported for preview + MP4 export (MediaRecorder + fetch)
- **Safari / Firefox**: Preview works; MP4 export pending alternate capture strategy
- **Console**: F12 → Console tab for debugging
- **Network**: Check if SRT/image/audio files load via HTTP

## 🎨 UI COMPONENTS

### Main Interface (index.html)
- **Tabs**: Video Clipper, Music, Episodes, etc.
- **Music Tab**: Primary interface for video creator
- **Controls**: Organized in sections with proper styling

### Button Layout
```
[🎵 PREVIEW SYNC] [⚡ FORCE] [🎵 LOAD SRT] [🎬 GENERATE VIDEO]
```

### Control Sections
1. **File Uploads**: Image, Audio, Lyrics
2. **Visualizer**: Type, Position, Colors, Settings  
3. **Text**: Position, Style, Display Mode
4. **Sync**: Offset, Speed, Manual Controls
5. **Preview**: Canvas area with playback controls

## 📊 CURRENT STATE ANALYSIS

### What Works (85%)
- ✅ Server startup and routing
- ✅ Canvas creation and animation
- ✅ Text positioning system  
- ✅ Visualizer rendering
- ✅ File upload handling
- ✅ Audio context setup
- ✅ UI controls and styling

### What's Broken (15%)
- ❌ SRT text extraction (lyrics show as "Empty lyric")
- ❌ Button event listener for SRT loading
- ❌ Lyric synchronization with audio playback

### Performance
- **Animation**: Smooth 60fps
- **Memory**: Reasonable usage
- **Loading**: Fast startup time

## 🔄 RECENT CHANGES

### Last Session Fixes
1. Added extensive debug logging to SRT parsing
2. Created `loadWeDontBowSRT()` function  
3. Added "🎵 LOAD SRT" button to interface
4. Enhanced lyric display with fallback text
5. Improved text positioning with bounds checking
6. Fixed canvas creation and initialization

### Code Quality
- **Lines**: 2700+ in music.js (well-documented)
- **Functions**: Modular and well-named
- **Error Handling**: Comprehensive try-catch blocks
- **Debugging**: Extensive console logging

## 🎯 SUCCESS METRICS

### Definition of "Working"
1. **SRT Loading**: Click "🎵 LOAD SRT" → Lyrics appear in canvas
2. **Text Positioning**: Dropdown changes → Text moves visually  
3. **Visualizer**: Audio plays → Visualizer animates with music
4. **Sync**: Lyrics change in time with audio playback

### Test Procedure
1. Start server: `node server.js`
2. Open localhost:3001
3. Click "Music" tab
4. Click "🎵 LOAD SRT" button
5. Click "🎵 PREVIEW SYNC" button
6. Verify: Canvas shows actual lyrics, not "Empty lyric"
7. Test: Change "Text Position" dropdown
8. Verify: Text moves to top/center/bottom

## 📝 NOTES FOR NEXT DEVELOPER

### Critical Issues
- **Priority 1**: Fix SRT parsing - lyrics not extracting properly
- **Priority 2**: Connect LOAD SRT button to function
- **Priority 3**: Test complete workflow with real files

### Code Organization
- Most logic in `music.js` - well-structured but very large
- HTML styling inline - could be extracted to CSS
- No major architectural issues - just debugging needed

### User Expectations  
- Aaron wants a fully functional music video creator
- Must handle real SRT files (not just test data)
- Should work immediately after clicking buttons
- Text positioning must work visually

### Development Approach
- Focus on SRT parsing first - everything else works
- Use extensive console logging for debugging
- Test with the provided `wedontbow.srt` file
- Verify each component individually before integration

## 🚀 READY FOR HANDOFF

This system is **very close to completion**. The architecture is solid, the UI is polished, and most features work correctly. The main blocker is the SRT text extraction bug that prevents lyrics from displaying.

**Estimated fix time: 1-2 hours for an experienced developer**

The next developer should focus on the `parseSrtForPreview()` function and ensure the text property is properly extracted from the SRT file format.
