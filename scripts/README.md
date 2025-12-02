# Firebase Token Generation Scripts

Generate Firebase ID tokens for testing without a frontend.

## 🚀 Quick Start

### Step 1: Get Your Firebase Web API Key

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: **saarthi-clinical**
3. Click ⚙️ **Project Settings** (gear icon)
4. Go to **General** tab
5. Scroll to **Your apps** section
6. Copy the **Web API Key** (looks like: `AIzaSy...`)

### Step 2: Generate Token

**Option A: Custom Token Method** (Recommended - works with any setup)
```bash
FIREBASE_API_KEY=your-api-key-here node scripts/generate-firebase-token.js test@example.com
```

**Option B: Email/Password Method** (Requires Email/Password auth enabled)
```bash
# First enable: Firebase Console > Authentication > Sign-in method > Email/Password
FIREBASE_API_KEY=your-api-key-here node scripts/generate-token-simple.js test@example.com password123
```

## 📋 Examples

```bash
# Generate token for test user
FIREBASE_API_KEY=AIzaSy... node scripts/generate-firebase-token.js test@example.com

# Generate token with custom UID
FIREBASE_API_KEY=AIzaSy... node scripts/generate-firebase-token.js test@example.com custom_uid_123

# Use the token to test your API
TOKEN=$(FIREBASE_API_KEY=AIzaSy... node scripts/generate-firebase-token.js test@example.com | grep -A1 "Your Firebase ID Token" | tail -1)

curl -X POST http://localhost:8787/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d "{\"idToken\":\"$TOKEN\"}"
```

## 🔍 Which Method to Use?

| Method | Pros | Cons |
|--------|------|------|
| **Custom Token** | Works without enabling auth providers | Requires service account |
| **Email/Password** | Simpler, direct | Requires Email/Password auth enabled |

## ⚠️ Notes

- Tokens expire after **1 hour** - generate a new one when needed
- The scripts use your service account from `.dev.vars` (for custom token method)
- For production testing, use the same scripts but point to production API

