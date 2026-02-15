/**
 * QR Code Scanner Service
 * Uses html5-qrcode library for camera-based QR code scanning
 */

let Html5Qrcode: any = null;
let html5QrCode: any = null;

// Dynamically import html5-qrcode only on client side
const loadHtml5QrCode = async () => {
  if (typeof window === 'undefined') {
    throw new Error('QR Scanner can only be used in browser');
  }
  
  if (!Html5Qrcode) {
    const module = await import('html5-qrcode');
    Html5Qrcode = module.Html5Qrcode;
  }
  return Html5Qrcode;
};

export interface QRScanResult {
  text: string;
  decodedText: string;
}

/**
 * Start QR code scanner
 */
export async function startQRScanner(
  elementId: string,
  onSuccess: (decodedText: string) => void,
  onError?: (error: string) => void
): Promise<void> {
  try {
    console.log('[QR Scanner] Starting...');
    
    // Load library
    const Html5QrcodeClass = await loadHtml5QrCode();
    
    // Create scanner instance if not exists
    if (!html5QrCode) {
      html5QrCode = new Html5QrcodeClass(elementId);
      console.log('[QR Scanner] Instance created');
    }

    // Request camera permission and start scanning
    console.log('[QR Scanner] Requesting camera access...');
    await html5QrCode.start(
      { facingMode: 'environment' }, // Use back camera on mobile
      {
        fps: 10, // Frames per second for scanning
        qrbox: { width: 200, height: 200 }, // Smaller scanning area
        aspectRatio: 1.0,
      },
      (decodedText: string) => {
        console.log('[QR Scanner] Decoded:', decodedText);
        onSuccess(decodedText);
      },
      (errorMessage: string) => {
        // Don't log every frame error, too verbose
        // console.log('[QR Scanner] Scan error:', errorMessage);
      }
    );

    console.log('[QR Scanner] Started successfully');
  } catch (error) {
    console.error('[QR Scanner] Failed to start:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to access camera';
    if (onError) {
      onError(errorMsg);
    }
    throw error;
  }
}

/**
 * Stop QR code scanner
 */
export async function stopQRScanner(): Promise<void> {
  try {
    if (html5QrCode && html5QrCode.isScanning) {
      await html5QrCode.stop();
      console.log('[QR Scanner] Stopped successfully');
    }
  } catch (error) {
    console.error('[QR Scanner] Failed to stop:', error);
  }
}

/**
 * Clear scanner instance
 */
export function clearQRScanner(): void {
  if (html5QrCode) {
    html5QrCode.clear();
    html5QrCode = null;
    console.log('[QR Scanner] Cleared');
  }
}

/**
 * Check if camera is supported
 */
export function isCameraSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  console.log('[QR Scanner] Camera supported:', supported);
  return supported;
}

/**
 * Validate if scanned text is an address
 */
export function isValidAddress(text: string): boolean {
  // Check if it's an EVM address (0x...)
  if (text.match(/^0x[a-fA-F0-9]{40}$/)) {
    return true;
  }
  
  // Check if it's a Cosmos address (inj1...)
  if (text.startsWith('inj1') && text.length >= 40) {
    return true;
  }
  
  return false;
}
