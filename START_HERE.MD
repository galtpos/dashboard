### START HERE – The Aaron Day Show

This document is the single source of truth for running and evolving the site. The workflow is Cursor-first: you give instructions in chat, and Cursor executes everything (dev, scripts, deploys). You do not need to run any commands locally.

## Architecture Overview
- **Frontend**: React + Vite + Tailwind in `aarondayshow/`
- **Hosting/Deploy**: Netlify (production domain: `theaarondayshow.com`)
- **Serverless (Netlify Functions)**: `/.netlify/functions/subscribe` (Mailchimp), `/.netlify/functions/og-image` (thumbnail scraper)
- **Backend**: Supabase (Auth, Postgres, RLS, Storage)
- **Supabase Edge Functions**: `facets` (faceted search), `ingest` (events/sponsor clicks), `import-transcript` (YouTube transcript import)
- **Data**: Tables include `episodes`, `transcript_segments`, `tags`, `episode_tags`, `tag_aliases`, `appearances`, `sponsors`, `comments`, `events`, `principles`, `speaker_nominations`, `user_profiles`, `principle_votes`, `nomination_votes`, `live_streams`, `live_comments`, `live_viewers` (see `db/001-init.sql` and subsequent migrations)
- **Branding**: Logo at `/ads-logo.jpg` (fallback `/daylight-logo.png`) and global Alpha banner

## Repos & Directories
- Root: project workspace
  - `aarondayshow/`: frontend app and Netlify config/functions
    - `src/`: React code
    - `public/`: public assets (place `ads-logo.jpg` here)
    - `netlify.toml`: build, headers (CSP), redirects
    - `netlify/functions/`: Netlify Functions (`subscribe.js`, `og-image.js`)
    - `scripts/`: operational Node scripts (transcripts import, tagging, admin user)
  - `supabase/functions/`: Edge Functions (`facets`, `ingest`, `import-transcript`)
  - `db/`: SQL schema and RLS migrations
    - `001-init.sql`: Base schema
    - `002-principles.sql`: Complex principles platform (deprecated)
    - `003-simplified-principles.sql`: Simplified principles and speaker nominations
    - `004-user-profiles.sql`: User profiles and RPC functions
    - `005-voting-system.sql`: Voting on principles and nominations
    - `006-livestream-system.sql`: Live streaming and real-time comments
  - `Transcripts/`: local transcript imports (.srt/.vtt/.json)

## Environments
- **Production** (Netlify): `theaarondayshow.com`
  - Builds from local via Netlify CLI (run by Cursor) or can be connected to GitHub for CI
- **Supabase Project**: hosts database, auth, and Edge Functions
  - **Local Supabase CLI**: Full local development environment configured (see CLI Setup section)
- **Local dev**: `vite` dev server, run by Cursor when needed

## Environment Variables (complete)

| Scope | Variable | Where to set | Purpose | Notes |
|---|---|---|---|---|
| Frontend (Vite) | `VITE_SUPABASE_URL` | Netlify Site Env + local `.env` | Supabase URL for browser client | Required |
| Frontend (Vite) | `VITE_SUPABASE_ANON_KEY` | Netlify Site Env + local `.env` | Supabase anon key for browser | Required |
| Frontend (Vite) | `VITE_ADMIN_EMAILS` | Netlify Site Env + local `.env` | Comma-separated admin allowlist | e.g., `ardventures@gmail.com` |
| Frontend (Vite) | `VITE_MONDAY_BOOKING_URL` | Netlify Site Env + local `.env` | Monday.com form embed URL | optional |
| Netlify Function | `MAILCHIMP_API_KEY` | Netlify Site Env | Mailchimp API key | format `xxxx-usXX` |
| Netlify Function | `MAILCHIMP_AUDIENCE_ID` | Netlify Site Env | Mailchimp Audience/List ID | required for subscribe |
| Supabase Edge | `SUPABASE_URL` | Supabase Functions Env | Supabase URL (Edge Functions) | required |
| Supabase Edge | `SUPABASE_ANON_KEY` | Supabase Functions Env | Supabase anon key | used by `facets`, `ingest` |
| Supabase Edge | `SUPABASE_SERVICE_ROLE_KEY` | Supabase Functions Env | Service role key | used by `import-transcript` |
| Node Scripts | `SUPABASE_SERVICE_ROLE_KEY` | Local `.env` (Cursor-managed) or CI Secret | Admin tasks (imports/tagging) | preferred over anon |
| Node Scripts | `VITE_SUPABASE_URL` | Local `.env` | Supabase URL for scripts | required |

Important:
- Only variables starting with `VITE_` are exposed to the browser. Keep secrets (API keys, service role) out of `VITE_` and only in server-side environments (Netlify Functions, Supabase Edge, or local `.env` used solely by scripts run via Cursor).

## Supabase CLI Setup ✅ CONFIGURED

**Status**: Local development environment is fully configured and ready to use!

### What's Available
- ✅ **Local Database Studio**: http://127.0.0.1:54323
- ✅ **Local API**: http://127.0.0.1:54321
- ✅ **Local Database**: postgresql://postgres:postgres@127.0.0.1:54322/postgres
- ✅ **Project Linked**: theaarondayshow (zuwbcjfyxeyyryeslwzd)
- ✅ **Migration System**: Operational with remote sync
- ✅ **Edge Functions**: All 9 functions accessible locally

### Key CLI Commands (Cursor runs these)
```bash
supabase status              # Check current status
supabase studio              # Open database studio in browser
supabase migration new       # Create new migration
supabase migration list      # View migration history
supabase db reset            # Reset local database
supabase db push             # Push changes to production
supabase functions list      # List edge functions
supabase functions deploy    # Deploy edge functions
```

### Development Workflow
1. **Make Changes**: Edit code locally and test
2. **Create Migrations**: `supabase migration new add_feature`
3. **Test Locally**: `supabase db reset` to apply migrations
4. **Push to Production**: `supabase db push` when ready

### Safety Notes
- **Production Data is Safe**: Local environment is completely separate from live site
- **Migration Testing**: Always test migrations locally before pushing to production
- **Edge Function Development**: Test functions locally before deploying

### Current Migration Status
- **Remote Migration**: `20240829` detected and synced
- **Edge Functions**: 9 active functions (facets, ingest, clip-share, youtube-transcript, etc.)
- **CLI Compatibility**: Apple Silicon compatibility issues resolved

## Operational Responsibilities (Cursor-first)
You can ask in chat for any of the following and Cursor will do it:
- "Update hero copy and deploy"
- "Create a new admin user for X"
- "Import transcripts from Transcripts/ and retag episodes"
- "Recompute tag counts"
- "Deploy to production"
- "Rotate Mailchimp key and verify subscribe flow"
- "Apply database migration X and verify"
- "Create live stream for YouTube URL"
- "Migrate live comments to episode when stream ends"
- "Check Owncast server status and restart if needed"
- "Monitor chat bridge and troubleshoot issues"
- "Update Owncast branding and theme"
- "Test OBS streaming to Owncast server"
- "Deploy enhanced chat polling updates"

### CLI-Specific Tasks (NEW)
- "Create a new database migration for feature X"
- "Test migration locally and push to production"
- "Open Supabase Studio to review database"
- "Deploy edge function X with changes"
- "Reset local database and resync with production"
- "Check migration status and repair if needed"

## Workflows

### Auth & Admin Access
- Auth via Supabase. Admin gate uses allowlist in `VITE_ADMIN_EMAILS` or user metadata `is_admin` (set by script below)
- Admin panel is at `/admin`. Sign in with Supabase email/password

Creating/updating an admin user (Cursor runs for you):
```bash
node aarondayshow/scripts/create-admin-user.cjs <email> <password>
```

### Mailchimp Newsletter
- Frontend calls `/.netlify/functions/subscribe`
- Requires `MAILCHIMP_API_KEY` and `MAILCHIMP_AUDIENCE_ID` in Netlify environment
- Existing member responses are treated as success

### "Book Aaron" (Monday.com)
- Set `VITE_MONDAY_BOOKING_URL` to your Monday.com Form URL (share/embed link)
- The page `Book.jsx` embeds the iframe automatically

### Appearances Thumbnails (og:image)
- `/.netlify/functions/og-image?url=<target>` scrapes `og:image` and normalizes absolute URL
- Fallbacks: resolved thumbnail or `/ads-logo.jpg`

### Transcripts Import (local files)
- Place `.srt`, `.vtt`, or JSON transcript files in `Transcripts/`
- Cursor runs the importer and matches files to episodes by SxEy/title cues
```bash
node aarondayshow/scripts/import-local-transcripts.cjs
```
Data lands in `transcript_segments` and is used for search/tagging.

### Automated Content Tagging
- Analyze transcripts + titles/summaries; ensures tags exist and links episodes to tags
```bash
node aarondayshow/scripts/enhanced-content-tagging.cjs all --force
```
Options: `--dry-run` to preview; `episode <youtube_id>` to target one episode.

### Fix Tag Counts (heat)
- Ensures `tags.heat` equals actual episode frequency
```bash
node aarondayshow/scripts/fix-tag-counts.cjs
```

### Supabase Edge Functions
- `facets`: computes tag facets for a filtered episode set
- `ingest`: records events and sponsor clicks
- `import-transcript`: scrapes/ingests YouTube captions (falls back to Invidious) and flags `has_transcript`
Set Edge env vars in Supabase Dashboard → Functions → Settings: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (for `import-transcript`).

### Live Streaming System (UPDATED)
- **Database Migration**: Apply `db/006-livestream-system.sql` in Supabase SQL Editor ✅ COMPLETED
- **Admin Management**: Use `/admin` → "Live Streams" tab to create/manage streams
- **Features**: 
  - Real-time chat for registered users with polling backup
  - Live navigation indicator (🔴 LIVE button appears in nav)
  - Comment highlighting for stream overlay
  - Viewer presence tracking
  - Comment migration to episodes when stream ends
  - Dedicated `/live` route for consistent access
- **Components**: `LiveStream.jsx` (homepage), `LiveStreamManager.jsx` (admin), `LivePage.jsx` (dedicated route)
- **API Functions**: `getCurrentLiveStream`, `addLiveComment`, `migrateLiveCommentsToEpisode`, etc.

### Owncast Self-Hosted Streaming ✅ OPERATIONAL

**Status**: Production-ready self-hosted streaming server with full integration!

#### Server Details
- ✅ **Production URL**: https://stream.theaarondayshow.com
- ✅ **RTMP Ingest**: rtmp://stream.theaarondayshow.com:1935/live
- ✅ **Stream Key**: ads-stream-33dd39dd73b41cbdb5cb5ad585167ff4
- ✅ **SSL Certificate**: Let's Encrypt HTTPS configured
- ✅ **Server**: DigitalOcean Ubuntu 22.04 (142.93.62.165)

#### Integration Components
- ✅ **Website Embed**: Owncast player embedded at `/live` route
- ✅ **Chat Bridge**: Node.js service monitoring website chat (`/home/owncast/chat-bridge/`)
- ✅ **Real-time Polling**: 3-second chat polling for reliable updates
- ✅ **Database Integration**: All chat messages saved to Supabase
- ✅ **Admin Controls**: Highlight/delete chat messages from website

#### OBS Configuration
```
Server: rtmp://stream.theaarondayshow.com:1935/live
Stream Key: ads-stream-33dd39dd73b41cbdb5ad585167ff4
```

#### Chat Bridge Service (Systemd)
- **Service**: `owncast-chat-bridge.service`
- **Status**: Active and monitoring
- **Logs**: `journalctl -u owncast-chat-bridge -f`
- **Location**: `/home/owncast/chat-bridge/`

#### Operational Commands (Cursor runs these)
```bash
# Check Owncast server status
ssh root@142.93.62.165 "systemctl status owncast"

# Monitor chat bridge
ssh root@142.93.62.165 "journalctl -u owncast-chat-bridge -f"

# Restart services if needed
ssh root@142.93.62.165 "systemctl restart owncast && systemctl restart owncast-chat-bridge"
```

#### Future Multi-Platform Integration (Planned)
- **Restream.io Integration**: Multi-platform streaming to YouTube, Twitch, Facebook + Owncast
- **Chat API Sync**: Website chat messages injected into all streaming platforms
- **Unified Analytics**: Cross-platform viewer and engagement metrics
- **Platform-Specific Optimizations**: Custom overlays and branding per platform

### Principles Platform
- **Database Migrations**: `db/003-simplified-principles.sql`, `db/004-user-profiles.sql`, `db/005-voting-system.sql`
- **Features**: Submit principles, nominate speakers, voting system, user profiles
- **Pages**: `/principles`, `/principles/submit`, `/principles/nominate`, `/profile/:username`
- **Voting**: Registered users can upvote/downvote principles and nominations

## Development
- Run locally when needed: Cursor will run `npm run dev` in `aarondayshow/` and open a preview
- Tailwind + Vite HMR are configured; CSP headers in `netlify.toml` allow common embeds

## Deployment
- Triggered by Cursor via Netlify CLI from `aarondayshow/`
- Production domain: `theaarondayshow.com`
- To deploy: "Deploy to production with message: …" (Cursor runs `netlify deploy --prod`)

## GitHub
- If the repo is connected to Netlify, merges to the main branch can auto-deploy
- If not connected, we deploy via CLI (current workflow). Cursor can initialize a GitHub repo, create branches, PRs, and connect Netlify on request

## Branding & UI Notes
- Logo path: `aarondayshow/public/ads-logo.jpg` (fallback `daylight-logo.png`)
- Header shows a thin Alpha banner at the top globally
- The logo is clickable and returns to Home; "Home" link also present in nav
- Live stream indicator appears in navigation when active

## Database Schema & Security
- Schema in `db/001-init.sql` and subsequent migrations
- Key tables: `episodes`, `transcript_segments`, `tags`, `episode_tags`, `tag_aliases`, `appearances`, `sponsors`, `comments`, `events`, `principles`, `speaker_nominations`, `user_profiles`, `principle_votes`, `nomination_votes`, `live_streams`, `live_comments`, `live_viewers`
- Scripts use the `SUPABASE_SERVICE_ROLE_KEY` for admin writes; do not expose this key in any browser environment
- RLS policies protect user data and ensure proper access control

## Video Clipper System ✅ OPERATIONAL

**Status**: Local video clipper is fully functional and ready for content creation!

### What's Available
- ✅ **Local Video Clipper**: http://localhost:3001 (Node.js/Express + HTML/JS frontend)
- ✅ **Pirate Broadcast Theme**: Military HUD aesthetic with "Maximum Controversy" branding
- ✅ **Auto-Transcript Mapping**: Automatically pairs videos with VTT transcripts
- ✅ **Viral Content Analysis**: AI-powered controversy scoring and viral moment detection
- ✅ **Multi-Platform Export**: TikTok (9:16), YouTube Shorts, Twitter/X (16:9), Rumble
- ✅ **4K Video Support**: Auto-detection with quality optimization (CRF 15-23)
- ✅ **Scrolling Banner**: Cross-platform font support with proper FFmpeg integration
- ✅ **Sponsor Integration**: Logo overlays with revenue tracking
- ✅ **Batch Processing**: Generate multiple clips from timestamp lists

### Directory Structure
- `local-video-clipper/`: Complete Node.js application
  - `server.js`: Express backend with FFmpeg integration
  - `public/`: Frontend with viral content analysis
  - `clips/`: Generated clip output directory
- `video-episodes/`: Place full episode video files here
- `Transcripts/`: VTT transcript files (auto-mapped to videos)
- `Transcripts_Claude_Ready/`: Converted SRT/VTT files for Claude analysis (57 files ready)

### Key Features Fixed
- ✅ **Banner Issue Resolved**: Fixed scrolling banner FFmpeg filter with cross-platform font support
- ✅ **SRT Conversion**: All 8 SRT files converted to Claude-ready format (17,606 segments, 796 minutes)
- ✅ **Transcript Integration**: VTT files automatically load with video selection
- ✅ **Viral Mode**: Full controversy analysis with engagement prediction

### Usage Commands (Cursor runs these)
```bash
cd local-video-clipper && node server.js    # Start video clipper server
node convert-srt-to-claude-text.js          # Convert SRT files for Claude
```

### Video Clipper Workflow
1. **Start Server**: Cursor runs the local clipper at localhost:3001
2. **Select Video**: Choose from auto-detected videos in parent directory
3. **Load Transcript**: VTT files auto-map and display in center panel
4. **Create Clips**: Manual timestamps or transcript-based selection
5. **Configure**: Banner text, sponsor logos, quality settings, aspect ratios
6. **Generate**: Single clips or batch processing with viral enhancements

## Recent Issues & Solutions
- **Owncast Integration**: Full self-hosted streaming server deployed at `stream.theaarondayshow.com` (Sep 2024)
- **Live Page Route**: Created dedicated `/live` route with embedded Owncast player and chat (Sep 2024)
- **Chat Bridge System**: Node.js service synchronizing website chat with real-time monitoring (Sep 2024)
- **Enhanced Chat Polling**: Added 3-second polling backup for reliable real-time chat updates (Sep 2024)
- **SSL Certificate**: Let's Encrypt HTTPS configured for secure streaming domain (Sep 2024)
- **OBS Integration**: RTMP streaming working with `rtmp://stream.theaarondayshow.com:1935/live` (Sep 2024)
- **Homepage Live Stream**: Fixed API call to show live stream prominently at top when broadcasting (Sep 2024)
- **Live Stream Navigation**: Added real-time detection and animated "🔴 LIVE" button in nav
- **Database Migrations**: All live streaming and voting system migrations ready to apply
- **Comment System**: Episode comments require user registration; live comments have real-time updates
- **Video Clipper Banner**: Fixed scrolling banner FFmpeg filter with cross-platform font detection (Sep 2024)
- **SRT Conversion**: Successfully converted all SRT files to Claude-ready text format (Sep 2024)
- **Transcript Loading**: Resolved VTT file parsing and auto-mapping issues (Sep 2024)
- **Cross-Episode Chat**: Implemented tag-based threading system spanning multiple episodes (Sep 2024)
- **IPFS Integration**: Automated stream archiving to IPFS for permanent decentralized storage (Sep 2024)
- **Voice Profile System**: Extracted 718,349 words from 47 VTT files for AI writing (Sep 2024)
- **Admin Dashboard**: Added Owncast server management and IPFS archiving controls (Sep 2024)

## Troubleshooting
- Not seeing changes: Hard refresh or clear cache; assets are immutable, logo uses cache-busting `?v=1`
- Netlify logs: Netlify Dashboard → Deploys → Build logs; Functions → Logs
- Supabase function logs: Supabase Dashboard → Edge Functions → Logs
- Mailchimp failures: verify API key suffix (e.g., `-us22`) and Audience ID
- Homepage black screen: Usually JavaScript error; check console and fix undefined variables
- Live stream not working: Ensure `db/006-livestream-system.sql` migration is applied
- Owncast server issues: Check `systemctl status owncast` and firewall rules (ports 80, 443, 1935)
- Chat bridge not working: Monitor with `journalctl -u owncast-chat-bridge -f`
- OBS connection failed: Verify RTMP URL and stream key; check server connectivity
- Chat polling issues: Check browser console for API errors and Supabase connection

## How to Use This Doc in Future Chats
- Open a new chat and say: "Use START_HERE.MD; you run all commands. Please <task>."
- Examples: 
  - "Import new transcripts and retag"
  - "Add admin X and deploy" 
  - "Rotate Mailchimp keys and test subscribe flow"
  - "Fix appearances thumbnails for URL Y"
  - "Apply live streaming migration and create first stream"
  - "Fix homepage crash and deploy to production"
  - "Migrate live comments from stream X to episode Y"

### CLI Development Examples (NEW)
- "Create a migration to add user preferences table"
- "Test the new voting system migration locally then push to production"
- "Open Supabase Studio to review the database schema"
- "Deploy the updated facets edge function"
- "Reset local database and pull latest production schema"

If anything is ambiguous, just describe the outcome you want—Cursor will read the codebase and take the correct actions for you.

## Starting a New Chat Session

**Copy this exact text to start your new chat:**

```
Use START_HERE.MD; you run all commands. The homepage is showing a black screen and needs to be fixed and deployed to production. The issue is likely a JavaScript runtime error. I've been working on a live streaming system but the homepage crash needs to be resolved first. Please:

1. Identify and fix the homepage JavaScript error
2. Deploy the fix to production immediately  
3. Verify the homepage loads properly
4. Then help with any remaining live streaming setup if needed

You are my dev team - handle everything end-to-end without requiring any actions from me.
```

This will give the new chat session full context about the homepage issue and your development workflow expectations.