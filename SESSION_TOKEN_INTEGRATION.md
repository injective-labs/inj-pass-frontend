# Session Token Authentication - Frontend Integration

This document describes the frontend implementation of session token authentication for the INJ Pass project, which eliminates the need for users to re-authenticate with passkey on every page refresh.

## Overview

The session token authentication system provides a seamless user experience by:
- Storing session tokens with 30-minute validity in localStorage
- Auto-unlocking wallets on page refresh when valid session exists
- Automatically locking wallets when session expires
- Clearing session tokens when user manually locks wallet

## Architecture

### Key Components

1. **Session Service** (`/src/services/session.ts`)
   - Manages session token storage and validation
   - Provides utilities for session lifecycle management

2. **Session Manager Hook** (`/src/services/useSessionManager.ts`)
   - React hook for automatic session expiry checking
   - Polls session validity every 60 seconds
   - Auto-locks wallet when session expires

3. **Wallet Context** (`/src/contexts/WalletContext.tsx`)
   - Enhanced with session auto-unlock on initialization
   - Attempts to unlock wallet with valid session token on mount
   - Clears session when user locks wallet

4. **Passkey Service** (`/src/services/passkey.ts`)
   - Updated to handle session token from backend response
   - `PasskeyVerifyResponse` now includes optional `sessionToken` field

## Frontend Flow

### Initial Login
1. User clicks "Unlock with Passkey" on unlock page
2. Frontend calls `unlockByPasskey()` which:
   - Requests WebAuthn challenge from backend
   - Gets WebAuthn assertion from browser
   - Sends assertion to backend for verification
3. Backend responds with verification result including `sessionToken`
4. Frontend saves session token to localStorage with 30-minute expiry
5. Wallet is unlocked and user redirected to dashboard

### Page Refresh (Auto-unlock)
1. App loads and WalletContext initializes
2. Context checks for valid session token in localStorage
3. If valid token exists:
   - Frontend calls backend `/session/unlock` endpoint with token
   - Backend validates token and returns encrypted wallet data
   - Wallet auto-unlocks without requiring passkey
4. If no valid token or token expired:
   - User redirected to unlock page

### Session Expiry
1. Session manager hook runs every 60 seconds
2. Checks if session token is expired (30 minutes since creation)
3. If expired:
   - Clears session token from localStorage
   - Locks wallet
   - Redirects to unlock page

### Manual Lock
1. User clicks "Lock Wallet" in settings
2. Frontend calls `lock()` which:
   - Clears session token from localStorage
   - Clears wallet state
   - Redirects to welcome page

## Backend API Requirements

The backend needs to implement the following endpoints and responses:

### 1. Passkey Verification Endpoint
**Endpoint**: `POST /api/passkey/verify`

**Request Body**:
```json
{
  "challenge": "base64_challenge_string",
  "attestation": {
    "id": "credential_id",
    "rawId": "base64_raw_id",
    "response": {
      "clientDataJSON": "base64_client_data",
      "authenticatorData": "base64_auth_data",
      "signature": "base64_signature"
    },
    "type": "public-key"
  }
}
```

**Response** (UPDATED):
```json
{
  "success": true,
  "verified": true,
  "credentialId": "credential_id",
  "sessionToken": "jwt_or_session_token_string"
}
```

**Implementation Notes**:
- Generate a session token (JWT recommended) after successful passkey verification
- Store session in Redis with 30-minute TTL
- Include user's wallet address or credential ID in session data

### 2. Session Validation Endpoint (Optional)
**Endpoint**: `POST /api/session/validate`

**Headers**:
```
Authorization: Bearer <session_token>
```

**Request Body**:
```json
{
  "token": "session_token"
}
```

**Response**:
```json
{
  "valid": true
}
```

### 3. Session Unlock Endpoint
**Endpoint**: `POST /api/session/unlock`

**Headers**:
```
Authorization: Bearer <session_token>
```

**Response**:
```json
{
  "address": "0x...",
  "privateKey": "hex_string_without_0x_prefix"
}
```

**Implementation Notes**:
- Validate session token from Redis
- Return encrypted private key or decryption parameters
- For security, consider returning only the entropy/decryption key rather than the actual private key

## Redis Session Storage

Recommended Redis session structure:

```javascript
// Key: `session:${sessionToken}`
// Value (JSON):
{
  "credentialId": "user_credential_id",
  "address": "0x...",
  "entropy": "hex_string", // For decrypting wallet
  "createdAt": 1234567890,
  "expiresAt": 1234569690
}

// TTL: 1800 seconds (30 minutes)
```

## Security Considerations

1. **Token Storage**: Session tokens are stored in localStorage (not sessionStorage) to persist across tabs
2. **Token Expiry**: Hard 30-minute expiry enforced both client and server side
3. **Auto-lock**: Client automatically locks wallet when session expires
4. **Manual Lock**: Clears session token immediately
5. **Transport Security**: All API calls should use HTTPS
6. **Token Format**: Recommend using JWT with proper signing
7. **Token Validation**: Backend should validate token on every request

## Configuration

Session duration can be configured in `/src/services/session.ts`:

```typescript
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
```

Session check interval in `/src/services/useSessionManager.ts`:

```typescript
const SESSION_CHECK_INTERVAL = 60 * 1000; // Check every 1 minute
```

## Testing Checklist

- [ ] Login with passkey successfully saves session token
- [ ] Page refresh auto-unlocks wallet with valid session
- [ ] Session expires after 30 minutes and requires re-authentication
- [ ] Manual lock clears session token
- [ ] Invalid/expired session redirects to unlock page
- [ ] Session works across multiple tabs
- [ ] Backend properly validates session tokens
- [ ] Redis properly stores and expires sessions

## Future Enhancements

1. **Session Renewal**: Extend session on user activity
2. **Multi-device Sessions**: Track sessions per device
3. **Session Management UI**: Show active sessions, allow remote logout
4. **Biometric Re-auth**: Quick biometric check instead of full passkey flow
5. **Remember Device**: Longer sessions for trusted devices

## Troubleshooting

### Session not persisting on refresh
- Check localStorage for `wallet_session_token` key
- Verify backend is returning `sessionToken` in verification response
- Check browser console for initialization errors

### Session expires too quickly
- Verify `SESSION_DURATION` constant is set correctly
- Check Redis TTL configuration
- Ensure system clocks are synchronized

### Auto-unlock not working
- Verify `/api/session/unlock` endpoint is implemented
- Check network tab for failed API calls
- Ensure session token is being sent in Authorization header

## API URL Configuration

Set the backend API URL in `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

For production:

```bash
NEXT_PUBLIC_API_URL=https://api.injective-pass.com
```
