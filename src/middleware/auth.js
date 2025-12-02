/**
 * Authentication Middleware
 * 
 * Protects routes by verifying Firebase tokens
 */

import { FirebaseAuthService } from '../services/firebase/auth.js';

/**
 * Get Firebase Auth Service from context
 */
function getFirebaseAuth(c) {
  const serviceAccount = c.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(c.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  if (!serviceAccount) {
    throw new Error('Firebase service account not configured');
  }

  return new FirebaseAuthService(serviceAccount);
}

export function createAuthMiddleware() {
  /**
   * Middleware to require authentication
   */
  return async (c, next) => {
    try {
      const authHeader = c.req.header('Authorization');
      
      if (!authHeader) {
        return c.json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'No authorization token provided'
          }
        }, 401);
      }

      // Extract Firebase token from Authorization header
      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : authHeader;

      // Get Firebase Auth service and verify token
      const firebaseAuth = getFirebaseAuth(c);
      const decoded = await firebaseAuth.verifyIdToken(token);
      
      // Get or create user in D1
      const user = await getOrCreateUserFromFirebase(c.env.DB, decoded);
      c.set('user', user);
      c.set('firebaseToken', decoded);

      await next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return c.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: error.message || 'Invalid or expired token'
        }
      }, 401);
    }
  };
}

/**
 * Middleware to require specific role
 */
export function requireRole(...roles) {
  return async (c, next) => {
    const user = c.get('user');
    
    if (!user) {
      return c.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, 401);
    }

    if (!roles.includes(user.role)) {
      return c.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required role: ${roles.join(' or ')}`
        }
      }, 403);
    }

    await next();
  };
}

/**
 * Convenience middleware for admin-only routes
 */
export function requireAdmin() {
  return requireRole('admin');
}
/**
 * Get or create user from Firebase token
 */
async function getOrCreateUserFromFirebase(db, firebaseToken) {
  const { uid, email, phone, emailVerified } = firebaseToken;
  
  // Check if user exists
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
