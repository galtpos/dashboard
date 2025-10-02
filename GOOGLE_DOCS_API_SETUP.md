# Google Docs API Setup Guide

## Required Permissions

The Article Automation system needs these Google API scopes:

1. **`https://www.googleapis.com/auth/documents`**
   - Create, read, and edit Google Docs
   - Required for: Uploading formatted articles

2. **`https://www.googleapis.com/auth/drive.file`**
   - Create and manage files in Google Drive
   - Required for: Creating new documents, getting shareable links

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it: `Article Automation` or similar
4. Click "Create"

### 2. Enable APIs

1. In your project, go to "APIs & Services" → "Library"
2. Search and enable:
   - **Google Docs API**
   - **Google Drive API**

### 3. Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure OAuth consent screen:
   - User Type: **External** (unless you have a workspace)
   - App name: `Article Automation`
   - User support email: Your email
   - Developer contact: Your email
   - Scopes: Add the two scopes above
   - Test users: Add your email
   
4. Back to "Create OAuth client ID":
   - Application type: **Desktop app**
   - Name: `Article Automation Desktop`
   - Click "Create"

5. Download the JSON file (it will be named like `client_secret_xxx.json`)

### 4. Install Credentials

```bash
# Create config directory
mkdir -p ~/.config/article_automation

# Copy your downloaded credentials file
cp ~/Downloads/client_secret_*.json ~/.config/article_automation/gdocs_credentials.json
```

### 5. Install Google Client Library

```bash
cd /Users/aaronday/Documents/TheAaronDayShow/local-video-clipper
pip3 install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client
```

### 6. First-Time Authorization

The first time you export to Google Docs:
1. A browser window will open
2. Sign in with your Google account
3. Click "Allow" to grant permissions
4. Browser will show "Authentication successful"
5. Close the browser tab

The system will save a token file (`~/.config/article_automation/token.json`) for future use.

## Testing the Setup

Once configured, test with:

```bash
curl -X POST http://localhost:5003/api/export/googledocs \
  -H "Content-Type: application/json" \
  -d '{"session_id":"YOUR_SESSION_ID"}'
```

You should get back a `google_docs_url` field with a shareable link.

## Permissions Summary

**What the app CAN do:**
- Create new Google Docs in your Drive
- Upload formatted articles
- Generate shareable links

**What the app CANNOT do:**
- Access existing documents you didn't create through it
- Delete files
- Access other Google services (Gmail, Calendar, etc.)
- Share your data with anyone else

## Troubleshooting

**"Credentials not found" error:**
- Check file exists: `ls ~/.config/article_automation/gdocs_credentials.json`
- Verify JSON is valid: `python3 -m json.tool ~/.config/article_automation/gdocs_credentials.json`

**"Access denied" during OAuth:**
- Make sure your email is added as a test user in OAuth consent screen
- Check that both APIs are enabled

**"Invalid scope" error:**
- Verify scopes in OAuth consent screen match exactly:
  - `https://www.googleapis.com/auth/documents`
  - `https://www.googleapis.com/auth/drive.file`

## Current Status

Without OAuth credentials configured:
- ✅ Export creates `.md` and `.html` files locally
- ✅ Gemini formats the article professionally
- ❌ Google Docs upload returns `null` (needs credentials)

With OAuth credentials:
- ✅ All of the above PLUS
- ✅ Automatic upload to your Google Drive
- ✅ Returns shareable link
- ✅ Document appears in "My Drive"

