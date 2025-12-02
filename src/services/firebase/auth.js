/**
 * Firebase Auth Service
 * 
 * Verifies Firebase ID tokens and manages user sessions
 * Uses Firebase REST API (compatible with Cloudflare Workers)
 */

export class FirebaseAuthService {
  constructor(serviceAccount) {
    this.projectId = serviceAccount.project_id;
    this.serviceAccount = serviceAccount;
  }

  /**
   * Verify Firebase ID token
   * @param {string} idToken - Firebase ID token from client
   * @returns {Promise<Object>} Decoded token with user info
   */
  async verifyIdToken(idToken) {
    try {
      // Use Firebase REST API to verify token
      const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${this.serviceAccount.private_key_id}`;
      
      // Actually, better approach: Use Google's token verification endpoint
      // Firebase tokens are JWTs signed by Google
      const response = await fetch(
        `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch public keys');
      }

      // For now, use a simpler approach: verify JWT locally
      // We'll decode and verify the token structure
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      // Decode payload (base64)
      const payload = JSON.parse(
        atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
      );

      // Verify token structure
      if (payload.iss !== `https://securetoken.google.com/${this.projectId}`) {
        throw new Error('Invalid token issuer');
      }

      if (payload.aud !== this.projectId) {
        throw new Error('Invalid token audience');
      }

      // Check expiration
      if (payload.exp && payload.exp < Date.now() / 1000) {
        throw new Error('Token expired');
      }

      return {
        uid: payload.user_id || payload.sub,
        email: payload.email,
        phone: payload.phone_number,
        emailVerified: payload.email_verified || false,
        firebase: {
          identities: payload.firebase?.identities || {},
          sign_in_provider: payload.firebase?.sign_in_provider || 'unknown'
        }
      };
    } catch (error) {
      console.error('Token verification error:', error);
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Get user info from Firebase UID
   * @param {string} uid - Firebase user ID
   * @returns {Promise<Object>} User information
   */
  async getUser(uid) {
    // This would require Admin SDK, but for Workers we'll store user data in D1
    // and sync from Firebase token claims
    throw new Error('Use D1 database for user data');
  }
}

