/**
 * Authentication Routes
 * 
 * Handles Firebase OTP and OAuth authentication
 */

import { Hono } from 'hono';
import { FirebaseAuthService } from '../services/firebase/auth.js';
import { createAuthMiddleware, requireRole } from '../middleware/auth.js';

const auth = new Hono();

/**
 * Initialize Firebase Auth Service
 */
function getFirebaseAuth(c) {
  // Get service account from env (stored as secret)
  const serviceAccount = c.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(c.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  if (!serviceAccount) {
    throw new Error('Firebase service account not configured');
  }

  return new FirebaseAuthService(serviceAccount);
}

/**
 * Send OTP to phone number
 * POST /api/v1/auth/phone/send
 * 
 * Note: This requires Firebase Web API Key (not service account)
 * For production, OTP sending should happen on the client side using Firebase SDK
 */
auth.post('/phone/send', async (c) => {
  try {
    const { phoneNumber } = await c.req.json();

    if (!phoneNumber) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'phoneNumber is required (E.164 format: +1234567890)'
        }
      }, 400);
    }

    // Get Firebase Web API Key from env
    const apiKey = c.env.FIREBASE_API_KEY;
    if (!apiKey) {
      return c.json({
        success: false,
        error: {
          code: 'CONFIG_ERROR',
          message: 'FIREBASE_API_KEY not configured. Phone OTP should be sent from client using Firebase SDK.'
        }
      }, 500);
    }

    // Send OTP via Firebase REST API
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: phoneNumber,
        recaptchaToken: 'test' // In production, this should come from reCAPTCHA
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send OTP: ${error}`);
    }

    const data = await response.json();
    
    return c.json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        sessionInfo: data.sessionInfo // Client needs this to verify OTP
      }
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return c.json({
      success: false,
      error: {
        code: 'OTP_ERROR',
        message: error.message || 'Failed to send OTP'
      }
    }, 500);
  }
});

/**
 * Verify OTP and get Firebase ID token
 * POST /api/v1/auth/phone/verify
 * 
 * Note: This requires Firebase Web API Key
 * For production, OTP verification should happen on the client side using Firebase SDK
 */
auth.post('/phone/verify', async (c) => {
  try {
    const { sessionInfo, code } = await c.req.json();

    if (!sessionInfo || !code) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'sessionInfo and code are required'
        }
      }, 400);
    }

    // Get Firebase Web API Key from env
    const apiKey = c.env.FIREBASE_API_KEY;
    if (!apiKey) {
      return c.json({
        success: false,
        error: {
          code: 'CONFIG_ERROR',
          message: 'FIREBASE_API_KEY not configured. OTP verification should happen on client using Firebase SDK.'
        }
      }, 500);
    }

    // Verify OTP via Firebase REST API
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionInfo: sessionInfo,
        code: code
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to verify OTP: ${error}`);
    }

    const data = await response.json();
    const idToken = data.idToken;

    if (!idToken) {
      throw new Error('No ID token received from Firebase');
    }

    // Verify token and create/update user in D1
    const firebaseAuth = getFirebaseAuth(c);
    const decoded = await firebaseAuth.verifyIdToken(idToken);
    const user = await getOrCreateUser(c.env.DB, decoded);

    return c.json({
      success: true,
      message: 'Phone authentication successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          is_verified: user.is_verified
        },
        idToken: idToken, // Client should use this for subsequent API calls
        firebase_uid: decoded.uid
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return c.json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: error.message || 'Failed to verify OTP'
      }
    }, 401);
  }
});

/**
 * Verify Firebase ID token (from OTP or OAuth)
 * POST /api/v1/auth/verify
 * 
 * This is the main endpoint after client-side authentication
 * Client gets Firebase ID token from Firebase SDK, then sends it here
 */
auth.post('/verify', async (c) => {
  try {
    const { idToken } = await c.req.json();

    if (!idToken) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'idToken is required'
        }
      }, 400);
    }

    const firebaseAuth = getFirebaseAuth(c);
    const decoded = await firebaseAuth.verifyIdToken(idToken);

    // Get or create user in D1
    const user = await getOrCreateUser(c.env.DB, decoded);

    // Return success - client should use the Firebase token for subsequent requests
    return c.json({
      success: true,
      message: 'Authentication successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          is_verified: user.is_verified
        },
        // Client should continue using the Firebase idToken for API calls
        firebase_uid: decoded.uid
      }
    });
  } catch (error) {
    console.error('Auth verify error:', error);
    return c.json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: error.message || 'Authentication failed'
      }
    }, 401);
  }
});

/**
 * Get current user
 * GET /api/v1/auth/me
 */
auth.get('/me', createAuthMiddleware(), async (c) => {
  try {
    const user = c.get('user');

    // Get doctor profile if user is a doctor
    let doctor = null;
    if (user.role === 'doctor') {
      doctor = await c.env.DB.prepare(
        'SELECT * FROM doctors WHERE user_id = ?'
      ).bind(user.id).first();
    }

    return c.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          is_verified: user.is_verified,
          profile_completed: user.profile_completed
        },
        doctor: doctor ? {
          id: doctor.id,
          specialization: doctor.specialization,
          specializations: JSON.parse(doctor.specializations || '[]'),
          hospital: doctor.hospital,
          consultation_fee: doctor.consultation_fee,
          is_verified: doctor.is_verified
        } : null
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch user data'
      }
    }, 500);
  }
});

/**
 * Logout (client-side token removal)
 * POST /api/v1/auth/logout
 */
auth.post('/logout', createAuthMiddleware(), async (c) => {
  // Firebase tokens are stateless - logout is handled client-side
  // Client should remove the token from storage
  return c.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * Helper: Get or create user from Firebase token
 */
async function getOrCreateUser(db, firebaseToken) {
  const { uid, email, phone, emailVerified } = firebaseToken;
  
  let user = await db.prepare(
    'SELECT * FROM users WHERE firebase_uid = ?'
  ).bind(uid).first();

  if (user) {
    // Update last login
    await db.prepare(
      'UPDATE users SET updated_at = ? WHERE id = ?'
    ).bind(Date.now(), user.id).run();
    return user;
  }

  // Create new user
  const userId = `usr_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
  const now = Date.now();

  await db.prepare(`
    INSERT INTO users (id, firebase_uid, email, phone, name, is_verified, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    userId,
    uid,
    email || null,
    phone || null,
    email || phone || 'User',
    emailVerified || false,
    now,
    now
  ).run();

  return {
    id: userId,
    firebase_uid: uid,
    email,
    phone,
    name: email || phone || 'User',
    role: 'user',
    is_verified: emailVerified || false,
    profile_completed: false,
    created_at: now,
    updated_at: now
  };
}

export default auth;

