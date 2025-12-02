# Authentication Flow

## 🔐 Overview

Saarthi Clinical uses **Firebase Authentication** for user authentication. There are three ways to authenticate:

## 1. Phone OTP (Backend Endpoints) ⚠️ Limited

**Endpoints:**
- `POST /api/v1/auth/phone/send` - Send OTP to phone
- `POST /api/v1/auth/phone/verify` - Verify OTP and get token

**Limitations:**
- Requires `FIREBASE_API_KEY` in environment
- May require reCAPTCHA tokens (typically client-side)
- **Recommended**: Use client-side Firebase SDK instead

**Usage:**
```bash
# 1. Send OTP
curl -X POST http://localhost:8787/api/v1/auth/phone/send \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+919876543210"}'

# Response: {"success": true, "data": {"sessionInfo": "..."}}

# 2. Verify OTP
curl -X POST http://localhost:8787/api/v1/auth/phone/verify \
  -H "Content-Type: application/json" \
  -d '{"sessionInfo": "...", "code": "123456"}'

# Response: {"success": true, "data": {"idToken": "...", "user": {...}}}
```

## 2. Client-Side Authentication (Recommended) ✅

**Flow:**
1. Client uses Firebase SDK to authenticate (phone OTP, Google OAuth, etc.)
2. Client gets Firebase ID token from Firebase SDK
3. Client sends token to backend: `POST /api/v1/auth/verify`
4. Backend verifies token and creates/updates user in D1
5. Client uses the same Firebase token for all API calls

**Example (Frontend):**
```javascript
import { signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';

// 1. Send OTP (client-side)
const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
  size: 'invisible',
});
const confirmationResult = await signInWithPhoneNumber(
  auth, 
  '+919876543210', 
  recaptchaVerifier
);

// 2. Verify OTP (client-side)
const result = await confirmationResult.confirm(otpCode);
const idToken = await result.user.getIdToken();

// 3. Send to backend
const response = await fetch('http://localhost:8787/api/v1/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken })
});

// 4. Use token for API calls
localStorage.setItem('firebaseToken', idToken);
```

## 3. Token Generation (For Testing) 🧪

**Script:**
```bash
FIREBASE_API_KEY=your-key node scripts/generate-firebase-token.js test@example.com
```

**Use Case:**
- Testing without frontend
- Development/debugging
- API testing with Postman

## 📋 API Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/v1/auth/phone/send` | POST | Send OTP to phone | No |
| `/api/v1/auth/phone/verify` | POST | Verify OTP, get token | No |
| `/api/v1/auth/verify` | POST | Verify Firebase ID token | No |
| `/api/v1/auth/me` | GET | Get current user | Yes |
| `/api/v1/auth/logout` | POST | Logout | Yes |

## 🔑 Using Tokens

After authentication, include the Firebase ID token in all protected API calls:

```bash
curl -X GET http://localhost:8787/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

## ⚙️ Environment Variables

**Required:**
- `FIREBASE_SERVICE_ACCOUNT` - Service account JSON (for token verification)
- `FIREBASE_API_KEY` - Web API Key (for phone OTP endpoints, optional)

**Get FIREBASE_API_KEY:**
1. Go to Firebase Console
2. Project Settings > General
3. Copy "Web API Key"

## 🐛 Troubleshooting

### Error: "firebaseAuth.verifyIdToken is not a function"
- **Fixed**: Middleware now creates FirebaseAuthService instance properly

### Error: "FIREBASE_API_KEY not configured"
- Add `FIREBASE_API_KEY` to `.dev.vars` for local development
- Or use client-side authentication instead

### Error: "Token expired"
- Firebase tokens expire after 1 hour
- Get a fresh token: `await auth.currentUser.getIdToken(true)`

### Phone OTP not working
- Phone OTP via REST API may require reCAPTCHA
- **Solution**: Use client-side Firebase SDK instead

## 📱 Recommended Flow for Production

1. **Frontend**: Use Firebase SDK for authentication
   - Phone OTP with reCAPTCHA
   - Google OAuth
   - Email/Password

2. **Backend**: Only verify tokens
   - `POST /api/v1/auth/verify` - Verify Firebase ID token
   - `GET /api/v1/auth/me` - Get user info (protected)

3. **All API Calls**: Include token in Authorization header
   - `Authorization: Bearer <firebase-token>`

