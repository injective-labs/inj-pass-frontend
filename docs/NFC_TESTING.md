# NFC Integration Testing Guide

## Quick Start

### 1. Development Testing (No Real NFC)

```bash
cd frontend
npm run dev
```

Open http://localhost:3001 and test the UI flow:
- NFC button appears in send page
- Card manager opens in cards page
- Error messages show "NFC not supported" (expected on desktop)

### 2. Vercel Deployment for Real Testing

```bash
# Make sure all changes are committed
git add .
git commit -m "Add NFC features"
git push

# Deploy to Vercel
vercel --prod
```

### 3. Testing on Android Device

1. **Prerequisites:**
   - Android phone with NFC
   - Chrome browser installed
   - NFC enabled in phone settings
   - Blank NFC cards (ISO 14443 Type A recommended)

2. **Open the diagnostic page first:**
   ```
   https://your-app.vercel.app/nfc-test
   ```
   
   Check that all indicators are green:
   - API Support: ✓ Supported
   - HTTPS: ✓ Secure
   - Browser: Chrome

3. **Test Card Binding:**
   - Go to Cards page
   - Click "Add New Card"
   - Click "Tap Card Now"
   - Hold NFC card to back of phone
   - Verify with Passkey
   - Check that card appears in list

4. **Test Card Reading:**
   - Go to Send page
   - Click wave icon next to address field
   - Tap the same NFC card
   - Check that address is filled in

## Common Issues

### "NFC is not supported"
- ❌ Not using Chrome
- ❌ Not on Android
- ❌ Not HTTPS (except localhost)
- **Fix:** Deploy to Vercel (HTTPS) and use Chrome on Android

### "NFC permission denied"
- ❌ User clicked "Don't allow"
- **Fix:** Clear site data and try again, or go to browser settings

### "NFC scan timeout"
- ❌ Card not held close enough
- ❌ Card not compatible
- **Fix:** Hold card steady for 2-3 seconds, try different card type

### "This card is already bound"
- ❌ Trying to bind same card twice
- **Fix:** Use a different card, or unbind the existing one first

### "Failed to write to NFC card"
- ❌ Card is read-only
- ❌ Card is locked
- ❌ Insufficient space
- **Fix:** Use a writable NFC card (most blank cards work)

## Debugging

### Enable Console Logs

Open Chrome DevTools on Android:
1. Connect phone via USB
2. Enable USB debugging on phone
3. Open `chrome://inspect` on desktop Chrome
4. Inspect your app
5. Watch console for `[NFC]` logs

### Check NFC Support

Visit the diagnostic page:
```
https://your-app.vercel.app/nfc-test
```

This page shows:
- Whether NFC API is available
- Current browser and context
- Live scanning test
- Debug logs

## Recommended NFC Cards

### Best for Testing
- **NTAG215/216**: Common, cheap, good storage
- **Mifare Classic 1K**: Widely available
- **ISO 14443 Type A**: Most compatible

### Where to Buy
- Amazon: "NFC cards blank"
- AliExpress: "NTAG215 cards"
- Local electronics stores

### Card Specifications
- Memory: At least 144 bytes (NTAG215 has 504 bytes)
- Type: ISO 14443 Type A or Type F
- Frequency: 13.56 MHz

## Data Storage Format

Cards store JSON data as NDEF text record:

```json
{
  "address": "0x1234...",
  "cardNumber": "6234 5678 9012 3456",
  "cvv": "789",
  "boundAt": "2024-01-29T10:30:00.000Z"
}
```

## Security Considerations

1. **Passkey Required**: All card operations require Passkey verification
2. **Local Storage**: Card data is stored locally per wallet address
3. **No Server Storage**: Card UIDs are not sent to any server
4. **HTTPS Only**: Prevents MITM attacks
5. **User Confirmation**: Unbind requires explicit confirmation

## Production Readiness

Before going live, ensure:

- [ ] All NFC operations tested on real Android device
- [ ] Error handling works correctly
- [ ] Passkey verification tested
- [ ] Card binding/unbinding works
- [ ] Address scanning works
- [ ] QR codes display correctly
- [ ] Multiple cards can be bound
- [ ] Frozen cards don't work for scanning
- [ ] Unbound cards can be re-bound
- [ ] localStorage persists across sessions

## Next Steps

1. Deploy to Vercel
2. Test on Android Chrome
3. Try binding multiple cards
4. Test scanning in send page
5. Verify card management features
6. Check localStorage persistence

## Support

For NFC-related issues, check:
- Browser console for `[NFC]` logs
- `/nfc-test` diagnostic page
- Android NFC settings
- Chrome version (must be 89+)
