This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## NFC Card Features

This project includes real NFC card integration using the Web NFC API.

### Requirements

- **Android device** with NFC capability
- **Chrome browser** (version 89 or later)
- NFC enabled in device settings

### How to Use NFC Cards

1. **Scanning a Card (Send Page)**
   - Go to the Send page
   - Click the hand/wave icon next to the recipient address field
   - Tap your NFC card to the back of your Android phone
   - The wallet address will be automatically filled in

2. **Binding a Card (Cards Page)**
   - Go to the Cards page
   - Click "Add New Card"
   - Tap your NFC card to bind it
   - Verify with your Passkey
   - Your wallet address and card info will be written to the NFC card

3. **Managing Cards**
   - View all bound cards on the Cards page
   - Flip cards to see management options
   - Freeze/Unfreeze cards to disable/enable them
   - View QR code of your wallet address
   - Unbind cards (requires Passkey verification)

### NFC Limitations

- Web NFC API only works on Android Chrome (not iOS, not other browsers)
- HTTPS is required in production (or localhost for development)
- User must grant NFC permission when first scanning

### Testing on Device

To test NFC features on your Android phone:

1. Deploy the app to Vercel (provides HTTPS)
2. Open the deployed URL on your Android Chrome browser
3. Enable NFC in your phone settings
4. Tap an NFC card when prompted

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or(recommend)
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
