#!/usr/bin/env node

/**
 * Simple Firebase ID Token Generator
 * 
 * Alternative method: Creates a test user via REST API and gets ID token
 * Requires: Email/Password auth enabled in Firebase Console
 * 
 * Usage:
 *   FIREBASE_API_KEY=your-api-key node scripts/generate-token-simple.js test@example.com password123
 */

async function createUserAndGetToken(apiKey, email, password) {
  // Step 1: Create user (or sign in if exists)
  const signUpUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
  
  let idToken;
  
  try {
    // Try to create user
    const signUpResponse = await fetch(signUpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true
      })
    });

    if (signUpResponse.ok) {
      const data = await signUpResponse.json();
      idToken = data.idToken;
      console.log('✅ User created and signed in');
    } else {
      // User might already exist, try to sign in
      const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
      const signInResponse = await fetch(signInUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true
        })
      });

      if (signInResponse.ok) {
        const data = await signInResponse.json();
        idToken = data.idToken;
        console.log('✅ User signed in');
      } else {
        const error = await signInResponse.text();
        throw new Error(`Failed to sign in: ${error}`);
      }
    }
  } catch (error) {
    throw new Error(`Auth failed: ${error.message}`);
  }

  return idToken;
}

async function main() {
  const apiKey = process.env.FIREBASE_API_KEY;
  const email = process.argv[2] || 'test@example.com';
  const password = process.argv[3] || 'test123456';

  if (!apiKey) {
    console.error('❌ Error: FIREBASE_API_KEY environment variable not set');
    console.error('\nTo get your API key:');
    console.error('  1. Go to: https://console.firebase.google.com');
    console.error('  2. Select project: saarthi-clinical');
    console.error('  3. Project Settings > General > Web API Key');
    console.error('\nThen run:');
    console.error(`  FIREBASE_API_KEY=your-key node scripts/generate-token-simple.js ${email} ${password}`);
    process.exit(1);
  }

  try {
    console.log(`🔑 Creating/signing in user: ${email}`);
    const idToken = await createUserAndGetToken(apiKey, email, password);
    
    console.log('\n📋 Your Firebase ID Token:');
    console.log('─'.repeat(80));
    console.log(idToken);
    console.log('─'.repeat(80));
    console.log('\n💡 Usage:');
    console.log(`   curl -X POST http://localhost:8787/api/v1/auth/verify \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"idToken":"${idToken}"}'`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n💡 Make sure Email/Password auth is enabled in Firebase Console:');
    console.error('   Authentication > Sign-in method > Email/Password > Enable');
    process.exit(1);
  }
}

main();

