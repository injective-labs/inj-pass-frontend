/**
 * QR Code Scanner Service
 * Uses html5-qrcode library for camera-based QR code scanning
 */

import { Html5Qrcode } from 'html5-qrcode';

export interface QRScanResult {
  text: string;
  decodedText: string;
}

let html5QrCode: Html5Qrcode | null = null;

/**
 * Start QR code scanner
 */
export async function startQRScanner(
  elementId: string,
  onSuccess: (decodedText: string) => void,
  onError?: (error: string) => void
): Promise<void> {
  try {
    // Create scanner instance if not exists
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode(elementId);
    }

    // Request camera permission and start scanning
    await html5QrCode.start(
      { facingMode: 'environment' }, // Use back camera on mobile
      {
        fps: 10, // Frames per second for scanning
        qrbox: { width: 250, height: 250 }, // Scanning area
        aspectRatio: 1.0,
      },
      (decodedText) => {
        console.log('[QR Scanner] Decoded:', decodedText);
        onSuccess(decodedText);
      },
      (errorMessage) => {
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
  }
}

/**
 * Check if camera is supported
 */
export function isCameraSupported(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
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
