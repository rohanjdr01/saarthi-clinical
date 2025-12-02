# Local Testing Guide

## 🚀 Quick Start

### 1. Start Local Dev Server

```bash
npm run dev
```

The server will start at `http://localhost:8787`

### 2. Verify Setup

Check that Firebase service account is configured:

```bash
# The .dev.vars file should contain:
# - GEMINI_API_KEY
# - OPENAI_API_KEY  
# - FIREBASE_SERVICE_ACCOUNT (JSON string)
```

### 3. Initialize Local Database

```bash
# Run schema
npm run d1:init

# Run auth migration
npx wrangler d1 execute DB --local --file=./migrations/002_add_auth_tables.sql
```

### 4. Test Health Endpoint

```bash
curl http://localhost:8787/api/v1/health
```

Should return: `{"success":true,"message":"Service is healthy"}`

## 🔐 Testing Firebase Auth

### Option 1: Using Firebase Web App

1. Create a simple HTML file with Firebase SDK
2. Authenticate with phone OTP or Google OAuth
3. Get the Firebase ID token
4. Use it in API calls

### Option 2: Using Postman

1. Import `postman_collection.json`
2. Set `localUrl` variable to `http://localhost:8787`
3. Get a Firebase token (from your frontend or Firebase Console)
4. Set `firebaseToken` variable
5. Test endpoints

### Option 3: Manual Testing with curl

```bash
# 1. Get Firebase ID token (from your frontend/client)
FIREBASE_TOKEN="your-firebase-id-token-here"

# 2. Verify token
curl -X POST http://localhost:8787/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d "{\"idToken\":\"$FIREBASE_TOKEN\"}"

# 3. Get current user
curl -X GET http://localhost:8787/api/v1/auth/me \
  -H "Authorization: Bearer $FIREBASE_TOKEN"
```

## 📝 Getting a Firebase Token for Testing (No Frontend Required)

### Method 1: Using Node.js Script (Recommended)

We have two scripts to generate Firebase ID tokens:

#### Option A: Custom Token Method (Works with any auth provider)

```bash
# 1. Get your Firebase Web API Key from:
#    Firebase Console > Project Settings > General > Web API Key

# 2. Run the script
FIREBASE_API_KEY=your-api-key node scripts/generate-firebase-token.js test@example.com

# Optional: Specify custom UID
FIREBASE_API_KEY=your-api-key node scripts/generate-firebase-token.js test@example.com custom_uid_123
```

This script:
- Uses your service account (from `.dev.vars`)
- Creates a custom token
- Exchanges it for an ID token
- Works without enabling any auth providers

#### Option B: Email/Password Method (Simpler, but requires setup)

```bash
# 1. Enable Email/Password auth in Firebase Console:
#    Authentication > Sign-in method > Email/Password > Enable

# 2. Get your Firebase Web API Key

# 3. Run the script
FIREBASE_API_KEY=your-api-key node scripts/generate-token-simple.js test@example.com password123
```

This script:
- Creates a test user (or signs in if exists)
- Gets ID token directly
- Simpler but requires Email/Password auth enabled

### Method 2: Using curl (REST API)

If Email/Password auth is enabled:

```bash
# Get your Firebase Web API Key first
FIREBASE_API_KEY=your-api-key

# Create user and get token
curl -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$FIREBASE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456",
    "returnSecureToken": true
  }'

# Extract idToken from response
```

### Method 3: Simple Test Page (If you want a quick UI)

Create `test-auth.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js"></script>
</head>
<body>
  <button onclick="testAuth()">Get Token</button>
  <pre id="output"></pre>
  
  <script>
    // Initialize Firebase (use your config)
    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "saarthi-clinical.firebaseapp.com",
      projectId: "saarthi-clinical"
    };
    firebase.initializeApp(firebaseConfig);
    
    async function testAuth() {
      const auth = firebase.auth();
      
      // Sign in with Google (or phone)
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      const token = await result.user.getIdToken();
      
      document.getElementById('output').textContent = token;
      console.log('Token:', token);
    }
  </script>
</body>
</html>
```

## 🐛 Troubleshooting

### Error: "Firebase service account not configured"

- Check `.dev.vars` file exists
- Verify `FIREBASE_SERVICE_ACCOUNT` is set
- Restart dev server after updating `.dev.vars`

### Error: "no such table: users"

- Run database migrations:
  ```bash
  npx wrangler d1 execute DB --local --file=./migrations/002_add_auth_tables.sql
  ```

### Error: "Invalid token format"

- Make sure you're using a Firebase ID token (not a custom token)
- Token should be a long JWT string (starts with `eyJ...`)

### Port Already in Use

```bash
# Kill process on port 8787
lsof -ti:8787 | xargs kill -9
```

## 📚 Next Steps

- Test protected routes (e.g., patient creation)
- Test role-based access (doctor vs user)
- Test document processing with auth

