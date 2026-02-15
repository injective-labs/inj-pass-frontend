/**
 * Test Passkey integration
 * Run this in browser console or create a test page
 */

// Test configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || (() => {
  throw new Error('NEXT_PUBLIC_API_URL environment variable is required');
})();

// Helper functions
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Test registration flow
async function testRegistration() {
  console.log('🧪 Testing Passkey Registration...\n');

  try {
    // Step 1: Request challenge
    console.log('1️⃣ Requesting challenge...');
    const challengeRes = await fetch(`${API_URL}/passkey/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register', userId: 'test-user' }),
    });

    if (!challengeRes.ok) {
      throw new Error(`Challenge request failed: ${challengeRes.statusText}`);
    }

    const { challenge, rpId, rpName } = await challengeRes.json();
    console.log('✅ Challenge received:', challenge.substring(0, 20) + '...');
    console.log('   RP ID:', rpId);
    console.log('   RP Name:', rpName);

    // Step 2: Create credential
    console.log('\n2️⃣ Creating WebAuthn credential...');
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: base64ToArrayBuffer(challenge),
        rp: { id: rpId, name: rpName },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: 'test-user@example.com',
          displayName: 'Test User',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        timeout: 60000,
        attestation: 'none',
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          requireResidentKey: false,
          userVerification: 'required',
        },
      },
    })) as PublicKeyCredential;

    if (!credential) {
      throw new Error('Credential creation cancelled');
    }

    console.log('✅ Credential created:', credential.id);

    // Step 3: Verify with backend
    console.log('\n3️⃣ Verifying with backend...');
    const response = credential.response as AuthenticatorAttestationResponse;

    const verifyRes = await fetch(`${API_URL}/passkey/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challenge,
        attestation: {
          id: arrayBufferToBase64(credential.rawId), // Use rawId, not credential.id
          rawId: arrayBufferToBase64(credential.rawId),
          response: {
            clientDataJSON: arrayBufferToBase64(response.clientDataJSON),
            attestationObject: arrayBufferToBase64(response.attestationObject),
          },
          type: credential.type,
        },
      }),
    });

    if (!verifyRes.ok) {
      throw new Error(`Verification failed: ${verifyRes.statusText}`);
    }

    const verifyResult = await verifyRes.json();
    console.log('✅ Verification result:', verifyResult);

    if (verifyResult.success) {
      console.log('\n🎉 Registration test PASSED!');
      console.log('   Credential ID:', verifyResult.credentialId);
      return verifyResult.credentialId;
    } else {
      throw new Error('Verification returned success=false');
    }
  } catch (error) {
    console.error('\n❌ Registration test FAILED:', error);
    throw error;
  }
}

// Test authentication flow
async function testAuthentication(credentialId: string) {
  console.log('\n\n🧪 Testing Passkey Authentication...\n');

  try {
    // Step 1: Request challenge
    console.log('1️⃣ Requesting challenge...');
    const challengeRes = await fetch(`${API_URL}/passkey/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'authenticate' }),
    });

    if (!challengeRes.ok) {
      throw new Error(`Challenge request failed: ${challengeRes.statusText}`);
    }

    const { challenge, rpId } = await challengeRes.json();
    console.log('✅ Challenge received:', challenge.substring(0, 20) + '...');

    // Step 2: Get assertion
    console.log('\n2️⃣ Getting WebAuthn assertion...');
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: base64ToArrayBuffer(challenge),
        rpId: rpId,
        timeout: 60000,
        userVerification: 'required',
      },
    })) as PublicKeyCredential;

    if (!assertion) {
      throw new Error('Authentication cancelled');
    }

    console.log('✅ Assertion received:', assertion.id);

    // Step 3: Verify with backend
    console.log('\n3️⃣ Verifying with backend...');
    const response = assertion.response as AuthenticatorAssertionResponse;

    const verifyRes = await fetch(`${API_URL}/passkey/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challenge,
        attestation: {
          id: arrayBufferToBase64(assertion.rawId), // Use rawId, not assertion.id
          rawId: arrayBufferToBase64(assertion.rawId),
          response: {
            clientDataJSON: arrayBufferToBase64(response.clientDataJSON),
            authenticatorData: arrayBufferToBase64(response.authenticatorData),
            signature: arrayBufferToBase64(response.signature),
            userHandle: response.userHandle
              ? arrayBufferToBase64(response.userHandle)
              : undefined,
          },
          type: assertion.type,
        },
      }),
    });

    if (!verifyRes.ok) {
      throw new Error(`Verification failed: ${verifyRes.statusText}`);
    }

    const verifyResult = await verifyRes.json();
    console.log('✅ Verification result:', verifyResult);

    if (verifyResult.success) {
      console.log('\n🎉 Authentication test PASSED!');
      return true;
    } else {
      throw new Error('Verification returned success=false');
    }
  } catch (error) {
    console.error('\n❌ Authentication test FAILED:', error);
    throw error;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Passkey Integration Tests\n');
  console.log('=' .repeat(50) + '\n');

  try {
    const credentialId = await testRegistration();
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
    await testAuthentication(credentialId);

    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL TESTS PASSED!');
  } catch (error) {
    console.log('\n' + '='.repeat(50));
    console.log('❌ TESTS FAILED');
  }
}

// Export for use in test page
if (typeof window !== 'undefined') {
  (window as any).testPasskey = {
    runAllTests,
    testRegistration,
    testAuthentication,
  };
}

export { runAllTests, testRegistration, testAuthentication };
