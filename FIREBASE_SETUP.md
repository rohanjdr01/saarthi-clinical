# Firebase Authentication Setup

## 🔥 Firebase Configuration

### Local Development Setup

1. **Add Firebase Service Account to `.dev.vars`**:
   ```bash
   # The .dev.vars file already contains FIREBASE_SERVICE_ACCOUNT
   # If you need to update it, add the JSON as a single-line string:
   FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"..."}
   ```

2. **Start local dev server**:
   ```bash
   npm run dev
   ```

3. **Initialize local D1 database** (if not already done):
   ```bash
   npm run d1:init
   npx wrangler d1 execute DB --local --file=./migrations/002_add_auth_tables.sql
   ```

4. **Test locally**:
   - Backend runs at: `http://localhost:8787`
   - Use Postman or curl to test endpoints
   - Example: `POST http://localhost:8787/api/v1/auth/verify`

### Production Setup

1. **Store Service Account as Secret**:
   ```bash
   # Set Firebase service account JSON as secret
   npx wrangler secret put FIREBASE_SERVICE_ACCOUNT --env production

   # When prompted, paste the entire JSON from your service account file
   # (You can read it with: cat saarthi-clinical-firebase-adminsdk-fbsvc-f824066b13.json)
   ```

2. **Run Database Migration**:
   ```bash
   # Add users and doctors tables
   npx wrangler d1 execute DB --env production --remote --file=./migrations/002_add_auth_tables.sql
   ```

## 📱 Frontend Integration

### Firebase Client SDK Setup

1. Install Firebase SDK:
```bash
npm install firebase
```

2. Initialize Firebase in your frontend:
```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "saarthi-clinical.firebaseapp.com",
  projectId: "saarthi-clinical",
  // ... from Firebase Console
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

### Phone OTP Flow

```javascript
import { signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';

// Initialize reCAPTCHA
const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
  size: 'invisible',
});

// Send OTP
const confirmationResult = await signInWithPhoneNumber(
  auth, 
  '+91XXXXXXXXXX', 
  recaptchaVerifier
);

// Verify OTP
const result = await confirmationResult.confirm(otpCode);
const idToken = await result.user.getIdToken();

// Send to backend
const response = await fetch('https://process.saarthihq.com/api/v1/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken })
});

const { data } = await response.json();
// User is now created/verified in backend
// Continue using Firebase idToken for API requests
localStorage.setItem('firebaseToken', idToken);
```

### Google OAuth Flow

```javascript
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

const provider = new GoogleAuthProvider();
const result = await signInWithPopup(auth, provider);
const idToken = await result.user.getIdToken();

// Send to backend (same as OTP)
const response = await fetch('https://process.saarthihq.com/api/v1/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken })
});
```

## 🔐 Using Firebase Token for API Calls

After authentication, use the Firebase ID token for protected routes:

```javascript
// Get Firebase token (refresh if expired)
const user = auth.currentUser;
const idToken = await user.getIdToken();

// Use Firebase token for API calls
const response = await fetch('https://process.saarthihq.com/api/v1/auth/me', {
  headers: {
    'Authorization': `Bearer ${idToken}`
  }
});
```

**Note**: Firebase tokens expire after 1 hour. The Firebase SDK automatically refreshes them. Always get a fresh token before making API calls:
```javascript
// Always get fresh token (handles refresh automatically)
const idToken = await auth.currentUser.getIdToken(true); // true = force refresh
```

## 📋 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/verify` | POST | Verify Firebase ID token, create/update user in D1 |
| `/api/v1/auth/me` | GET | Get current user (requires Firebase token) |
| `/api/v1/auth/logout` | POST | Logout (client-side token removal) |

## 🧪 Testing Locally

### Using curl

```bash
# 1. Get Firebase ID token from your frontend/client
# (You'll need to authenticate with Firebase first)

# 2. Verify token and create user
curl -X POST http://localhost:8787/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"idToken":"YOUR_FIREBASE_ID_TOKEN"}'

# 3. Get current user
curl -X GET http://localhost:8787/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN"
```

### Using Postman

1. Import the Postman collection: `postman_collection.json`
2. Update the `localUrl` variable to: `http://localhost:8787`
3. Get a Firebase token from your frontend
4. Set it in the `firebaseToken` variable
5. Test the auth endpoints

## ⚠️ Important Notes

1. **Firebase Token Verification**: Uses JWT decoding with issuer/audience validation. For production, consider implementing full signature verification using Google's public keys.

2. **Token Expiration**: Firebase tokens expire after 1 hour. Always get a fresh token before API calls using `getIdToken()`.

3. **CORS**: Make sure your frontend domain is in the CORS allowlist in `src/index.js`.

4. **Phone Auth**: Requires reCAPTCHA setup. For production, verify your domain in Firebase Console.

5. **Local Development**: The `.dev.vars` file contains your Firebase service account. Never commit this file to git (it should be in `.gitignore`).

