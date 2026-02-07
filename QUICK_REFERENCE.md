# Session Token Quick Reference

Quick reference for developers working with the session token implementation.

## For Frontend Developers

### Using Session Token in Components

```typescript
import { useWallet } from '@/contexts/WalletContext';
import { useSessionManager } from '@/services/useSessionManager';

function MyComponent() {
  const { isUnlocked, address } = useWallet();
  
  // This hook automatically monitors session and locks wallet on expiry
  useSessionManager();
  
  return (
    <div>
      {isUnlocked ? (
        <p>Wallet unlocked: {address}</p>
      ) : (
        <p>Wallet locked</p>
      )}
    </div>
  );
}
```

### Checking Session Status

```typescript
import { getSessionToken, hasValidSession } from '@/services/session';

// Check if valid session exists
if (hasValidSession()) {
  console.log('User has valid session');
}

// Get session details
const session = getSessionToken();
if (session) {
  console.log('Token:', session.token);
  console.log('Expires:', new Date(session.expiresAt));
  console.log('Address:', session.address);
}
```

### Manually Clearing Session

```typescript
import { clearSessionToken } from '@/services/session';
import { useWallet } from '@/contexts/WalletContext';

function LogoutButton() {
  const { lock } = useWallet();
  
  const handleLogout = () => {
    lock(); // This automatically calls clearSessionToken()
    router.push('/welcome');
  };
  
  return <button onClick={handleLogout}>Logout</button>;
}
```

## For Backend Developers

### Passkey Verification Response

After successful passkey verification, include `sessionToken`:

```typescript
// POST /api/passkey/verify
{
  "success": true,
  "verified": true,
  "credentialId": "abc123...",
  "sessionToken": "eyJhbGciOiJIUzI1NiIs..." // Add this field
}
```

### Session Unlock Endpoint

Implement this endpoint to return wallet data:

```typescript
// POST /api/session/unlock
// Headers: Authorization: Bearer <sessionToken>

// Response:
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "privateKey": "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
}
```

### Redis Session Storage

```typescript
// Store session after passkey verification
const sessionToken = generateJWT({
  credentialId: user.credentialId,
  address: user.address
});

await redis.setex(
  `session:${sessionToken}`,
  1800, // 30 minutes in seconds
  JSON.stringify({
    credentialId: user.credentialId,
    address: user.address,
    entropy: user.entropy, // For wallet decryption
    createdAt: Date.now()
  })
);
```

### Session Validation

```typescript
// Middleware to validate session token
async function validateSession(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const sessionData = await redis.get(`session:${token}`);
  
  if (!sessionData) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  
  req.session = JSON.parse(sessionData);
  next();
}
```

## Configuration

### Frontend Configuration

**Session Duration** (`src/services/session.ts`):
```typescript
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes
```

**Session Check Interval** (`src/services/useSessionManager.ts`):
```typescript
const SESSION_CHECK_INTERVAL = 60 * 1000; // Check every minute
```

**API URL** (`.env.local`):
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### Backend Configuration

**Redis TTL**:
```javascript
const SESSION_TTL = 1800; // 30 minutes in seconds
```

**JWT Expiry** (if using JWT):
```javascript
jwt.sign(payload, secret, { expiresIn: '30m' });
```

## Testing

### Test Session Creation

```typescript
// In browser console after login:
localStorage.getItem('wallet_session_token')
// Should show: {"token":"...","expiresAt":1234567890,"address":"0x..."}
```

### Test Session Auto-unlock

1. Login with passkey
2. Verify token in localStorage
3. Refresh page (F5)
4. Should auto-unlock without passkey prompt

### Test Session Expiry

```typescript
// Manually expire session (for testing):
const session = JSON.parse(localStorage.getItem('wallet_session_token'));
session.expiresAt = Date.now() - 1000; // Set to past
localStorage.setItem('wallet_session_token', JSON.stringify(session));

// Wait for session manager to run (up to 60 seconds)
// Wallet should auto-lock and redirect to unlock page
```

### Test Manual Lock

1. Click "Lock Wallet" in settings
2. Check localStorage - should be empty
3. Try refreshing - should redirect to unlock page

## Common Issues

### Session not persisting
- **Check**: Is `sessionToken` present in backend response?
- **Check**: Is localStorage enabled in browser?
- **Fix**: Verify backend returns sessionToken after passkey verification

### Auto-unlock not working
- **Check**: Is `/api/session/unlock` endpoint implemented?
- **Check**: Network tab for failed requests
- **Fix**: Implement session unlock endpoint in backend

### Session expires too quickly
- **Check**: `SESSION_DURATION` in `src/services/session.ts`
- **Check**: Redis TTL matches frontend duration
- **Fix**: Ensure both are set to 30 minutes (1800 seconds)

### TypeScript errors
- **Check**: Is `unlockByPasskey` destructured correctly?
- **Fix**: Use `const { entropy, sessionToken } = await unlockByPasskey(id)`

## API Endpoints Reference

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/passkey/challenge` | POST | Get WebAuthn challenge | No |
| `/api/passkey/verify` | POST | Verify passkey & get token | No |
| `/api/session/validate` | POST | Validate session token | Yes (Bearer) |
| `/api/session/unlock` | POST | Get wallet data from session | Yes (Bearer) |

## Security Checklist

- [ ] Session tokens are JWTs or cryptographically secure random strings
- [ ] Redis has 30-minute TTL on all sessions
- [ ] HTTPS is enforced in production
- [ ] Session tokens are never logged or exposed
- [ ] Backend validates token on every request
- [ ] Frontend auto-locks on session expiry
- [ ] Manual lock clears session immediately
- [ ] No sensitive data stored in localStorage except encrypted session token

## Performance Tips

1. **Minimize API calls**: Session check runs every 60s, not on every action
2. **Use localStorage**: Avoids server calls on page load
3. **Lazy validation**: Only validate with server when needed
4. **Multi-tab efficiency**: One session works across all tabs

## Next Steps

1. ✅ **Frontend Ready** - All code implemented
2. 🔨 **Backend TODO** - Implement session endpoints
3. 🧪 **Test** - Run through testing checklist
4. 🚀 **Deploy** - Roll out to production

For more details, see:
- [SESSION_TOKEN_INTEGRATION.md](./SESSION_TOKEN_INTEGRATION.md) - Complete integration guide
- [SESSION_FLOW_DIAGRAM.md](./SESSION_FLOW_DIAGRAM.md) - Visual flow diagrams
