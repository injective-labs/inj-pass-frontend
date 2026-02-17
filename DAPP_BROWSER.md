# DApp Browser Integration

## Overview

INJ Pass now includes a built-in DApp browser that allows users to interact with Web3 DApps directly within the wallet, without needing to switch to external browsers or wallets.

## Features

### 1. Real DApp Icons
- Automatically fetches and displays real logos from DApp websites
- Fallback to Google Favicon service if direct favicon fails
- Smooth loading with proper error handling

### 2. In-App Browser
- Full-featured web browser within INJ Pass
- Navigation controls (back, forward, refresh)
- Loading indicators
- Proper iframe sandboxing for security

### 3. Web3 Provider Injection
- Automatic injection of Web3 provider into DApp pages
- Compatible with MetaMask-style DApps
- Supports standard Web3 methods:
  - `eth_accounts`
  - `eth_requestAccounts`
  - `eth_chainId`
  - `eth_sendTransaction`
  - `personal_sign`
  - And more...

### 4. Transaction Approval
- In-app transaction approval modal
- Shows transaction details before signing
- User-friendly approve/reject interface

## How It Works

### Architecture

```
DApp Page (iframe)
    ↓
Web3 Provider (injected)
    ↓
PostMessage Bridge
    ↓
INJ Pass Wallet
    ↓
Injective Network
```

### Flow

1. User clicks on a DApp in the Discover page
2. DApp opens in a full-screen browser within INJ Pass
3. Web3 provider is automatically injected into the page
4. DApp detects the provider and can request wallet connection
5. When DApp requests a transaction, INJ Pass shows an approval modal
6. User approves/rejects the transaction
7. Transaction is signed and sent to Injective network

## Supported DApps

Currently featured DApps:
- **Helix** - Decentralized Derivatives Trading
- **INJ Ecosystem** - Explore the Injective Ecosystem
- **Astroport** - AMM & DEX Protocol
- **Talis** - NFT Marketplace
- **Injective Hub** - Governance & Staking
- **DojoSwap** - Swap & Earn Rewards

## Usage

### For Users

1. Open INJ Pass
2. Navigate to the **Discover** tab
3. Click on any DApp icon
4. The DApp will open in the built-in browser
5. Use the DApp as normal - it will automatically detect your INJ Pass wallet
6. Approve transactions when prompted

### For Developers

To add a new DApp to the Discover page:

```typescript
// In app/discover/page.tsx
const dapps: DApp[] = [
  {
    id: '1',
    name: 'Your DApp Name',
    description: 'Short description',
    icon: 'https://yourdapp.com/favicon.ico',
    category: 'defi', // 'defi' | 'nft' | 'game' | 'social' | 'dao'
    url: 'https://yourdapp.com',
    featured: true // Set to true for featured section
  },
  // ... other dapps
];
```

## Security Features

1. **Iframe Sandboxing**
   - Restricts iframe capabilities
   - Prevents unauthorized actions
   - Isolated from main app context

2. **Transaction Approval**
   - All transactions require explicit user approval
   - Shows full transaction details
   - Cannot be bypassed by DApps

3. **Chain Restriction**
   - Only Injective network (chain ID 888) is supported
   - Prevents accidental transactions on other networks

## Technical Details

### Web3 Provider Methods

Supported methods:
- ✅ `eth_accounts` - Get user accounts
- ✅ `eth_requestAccounts` - Request account access
- ✅ `eth_chainId` - Get current chain ID
- ✅ `eth_sendTransaction` - Send transaction
- ✅ `personal_sign` - Sign message
- ✅ `eth_signTypedData_v4` - Sign typed data
- ⚠️ `eth_call` - Coming soon
- ⚠️ `eth_estimateGas` - Coming soon

### Chain Configuration

- **Chain ID**: 888 (Injective EVM)
- **Network Name**: Injective
- **RPC URL**: Injective mainnet RPC
- **Block Explorer**: https://blockscout.injective.network/

## Limitations

Current limitations (to be addressed in future updates):

1. Transaction signing is not yet fully implemented
2. Message signing requires integration with passkey system
3. Some read-only RPC methods need RPC passthrough
4. No support for wallet_addEthereumChain (only Injective supported)
5. No support for ENS names yet

## Future Improvements

Planned features:
- [ ] Full transaction signing implementation
- [ ] Message signing with passkey
- [ ] RPC method passthrough for read operations
- [ ] Transaction history in DApp browser
- [ ] Bookmarks for favorite DApps
- [ ] Tab management for multiple DApps
- [ ] Deep linking from external sources
- [ ] WalletConnect support

## Testing

To test the DApp browser:

1. Open INJ Pass in development mode
2. Navigate to Discover tab
3. Click on any DApp (e.g., Helix)
4. Verify:
   - DApp loads correctly
   - Icons display properly
   - Browser controls work
   - Web3 provider is detected by DApp

## Troubleshooting

### Icons not loading
- Check network connection
- Verify DApp URL is correct
- Check browser console for CORS errors
- Fallback to Google Favicon service is automatic

### DApp not detecting wallet
- Check browser console for injection errors
- Verify iframe loaded correctly
- Ensure DApp supports MetaMask-style providers

### Transaction approval not showing
- Check if transaction signing is implemented
- Verify Web3 provider message passing
- Check browser console for errors

## Resources

- [Web3 Provider Specification](https://eips.ethereum.org/EIPS/eip-1193)
- [MetaMask Provider API](https://docs.metamask.io/wallet/reference/provider-api/)
- [Injective Documentation](https://docs.injective.network/)
