#!/usr/bin/env node

/**
 * Generate Firebase ID Token for Testing
 * 
 * This script uses Firebase Admin SDK to create a custom token,
 * then exchanges it for an ID token using Firebase REST API.
 * 
 * Usage:
 *   node scripts/generate-firebase-token.js [email] [uid]
 * 
 * Example:
 *   node scripts/generate-firebase-token.js test@example.com
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load service account from .dev.vars
function loadServiceAccount() {
  const devVarsPath = path.join(__dirname, '..', '.dev.vars');
  
  if (!fs.existsSync(devVarsPath)) {
    throw new Error('.dev.vars file not found');
  }

  const content = fs.readFileSync(devVarsPath, 'utf8');
  const match = content.match(/FIREBASE_SERVICE_ACCOUNT=(.+)$/m);
  
  if (!match) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT not found in .dev.vars');
  }

  try {
    return JSON.parse(match[1]);
  } catch (e) {
    throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT: ${e.message}`);
  }
}

// Create JWT for custom token
function createCustomToken(serviceAccount, uid, claims = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600, // 1 hour
    uid: uid,
    claims: claims
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureInput = `${headerB64}.${payloadB64}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(serviceAccount.private_key, 'base64url');

  return `${headerB64}.${payloadB64}.${signature}`;
}

// Exchange custom token for ID token
async function exchangeCustomTokenForIdToken(customToken, apiKey) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      token: customToken,
      returnSecureToken: true
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange token: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.idToken;
}

// Get Firebase Web API Key from project
async function getApiKey(projectId) {
  // For testing, you can get this from Firebase Console > Project Settings > General > Web API Key
  // Or we can try to infer it, but it's better to ask the user
  console.warn('⚠️  You need to provide your Firebase Web API Key');
  console.warn('   Get it from: Firebase Console > Project Settings > General > Web API Key');
  return null;
}

// Main function
async function main() {
  try {
    const email = process.argv[2] || 'test@example.com';
    const uid = process.argv[3] || `test_${Date.now()}`;
    const apiKey = process.env.FIREBASE_API_KEY;

    if (!apiKey) {
      console.error('❌ Error: FIREBASE_API_KEY environment variable not set');
      console.error('');
      console.error('To get your API key:');
      console.error('  1. Go to Firebase Console: https://console.firebase.google.com');
      console.error('  2. Select your project: saarthi-clinical');
      console.error('  3. Go to Project Settings > General');
      console.error('  4. Copy the "Web API Key"');
      console.error('');
      console.error('Then run:');
      console.error(`  FIREBASE_API_KEY=your-api-key node scripts/generate-firebase-token.js ${email}`);
      process.exit(1);
    }

    console.log('🔑 Loading Firebase service account...');
    const serviceAccount = loadServiceAccount();
    console.log(`✅ Loaded service account for project: ${serviceAccount.project_id}`);

    console.log(`\n🔨 Creating custom token for UID: ${uid}`);
    const customToken = createCustomToken(serviceAccount, uid, {
      email: email,
      email_verified: true
    });
    console.log('✅ Custom token created');

    console.log(`\n🔄 Exchanging custom token for ID token...`);
    const idToken = await exchangeCustomTokenForIdToken(customToken, apiKey);
    console.log('✅ ID token generated!\n');

    console.log('📋 Your Firebase ID Token:');
    console.log('─'.repeat(80));
    console.log(idToken);
    console.log('─'.repeat(80));
    console.log('\n💡 Usage:');
    console.log(`   curl -X POST http://localhost:8787/api/v1/auth/verify \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"idToken":"${idToken.substring(0, 50)}..."}'`);
    console.log('\n⚠️  Note: This token expires in 1 hour. Generate a new one when needed.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

