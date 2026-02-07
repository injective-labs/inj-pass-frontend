# INJ Pass Frontend

A Next.js-based wallet application for Injective with passkey authentication and session management.

## Features

- 🔐 **Passkey Authentication** - Secure, passwordless login using WebAuthn
- 🎫 **Session Token Management** - Stay logged in for 30 minutes without re-authentication
- 💳 **Multi-wallet Support** - Passkey, NFC, and password-based wallets
- ⚡ **Auto-unlock on Refresh** - Seamless experience across page refreshes
- 🔒 **Automatic Session Expiry** - Enhanced security with timed logout

## Session Token Authentication

This application implements session token authentication to provide a seamless user experience:

- **Login Once**: Authenticate with passkey, stay logged in for 30 minutes
- **No Re-auth on Refresh**: Page refreshes don't require passkey authentication
- **Auto-lock on Expiry**: Wallet automatically locks after 30 minutes
- **Multi-tab Support**: Session works across multiple browser tabs

For detailed information about the session token implementation, see:
- [Session Token Integration Guide](./SESSION_TOKEN_INTEGRATION.md) - Backend integration requirements
- [Session Flow Diagrams](./SESSION_FLOW_DIAGRAM.md) - Visual flow diagrams

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Configuration

Create a `.env.local` file with the following:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

For production, update to your production API URL.

## Backend Requirements

The backend must implement the following to support session token authentication:

1. **Passkey Verification** - Return `sessionToken` in `/api/passkey/verify` response
2. **Session Unlock** - Implement `/api/session/unlock` endpoint
3. **Redis Storage** - Store sessions with 30-minute TTL

See [SESSION_TOKEN_INTEGRATION.md](./SESSION_TOKEN_INTEGRATION.md) for complete backend requirements.

## Project Structure

- `/app` - Next.js app directory with pages
- `/src/contexts` - React contexts (WalletContext)
- `/src/services` - API services and utilities
  - `session.ts` - Session token management
  - `passkey.ts` - Passkey authentication
  - `useSessionManager.ts` - Session expiry hook
- `/src/wallet` - Wallet key management and cryptography
- `/src/types` - TypeScript type definitions

## Key Technologies

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe development
- **WebAuthn API** - Passkey authentication
- **Noble Crypto** - Cryptographic operations
- **Viem** - Ethereum utilities

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
