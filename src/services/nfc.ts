/**
 * NFC Service for Web NFC API
 * 
 * Supports reading and writing NFC cards
 * Primarily works on Android Chrome
 */

export interface NFCCardData {
  uid: string;
  address?: string;
  cardNumber?: string;
  cvv?: string;
  boundAt?: string;
}

/**
 * Check if Web NFC is supported
 */
export function isNFCSupported(): boolean {
  if (typeof window === 'undefined') return false;
  
  const supported = 'NDEFReader' in window;
  console.log('[NFC] Support check:', {
    supported,
    userAgent: navigator.userAgent,
    isSecureContext: window.isSecureContext,
  });
  
  return supported;
}

/**
 * Request NFC permission (optional, happens automatically on scan)
 */
export async function requestNFCPermission(): Promise<boolean> {
  if (!isNFCSupported()) {
    throw new Error('NFC is not supported on this device');
  }
  
  // Permission is requested automatically when scanning
  return true;
}

/**
 * Read data from NFC card
 * Returns the card UID and any stored data
 */
export async function readNFCCard(): Promise<NFCCardData> {
  if (!isNFCSupported()) {
    throw new Error('NFC is not supported on this device. Please use Android Chrome.');
  }

  try {
    const ndef = new (window as any).NDEFReader();
    console.log('[NFC] NDEFReader created successfully');
    console.log('[NFC] Starting NFC scan...');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn('[NFC] Scan timeout after 30 seconds');
        reject(new Error('NFC scan timeout - please try again'));
      }, 30000); // 30 second timeout

      ndef.scan().then(() => {
        console.log('[NFC] Scan started successfully, waiting for card...');

        ndef.onreading = (event: any) => {
          clearTimeout(timeout);
          console.log('[NFC] Card detected!');
          console.log('[NFC] Serial Number:', event.serialNumber);
          console.log('[NFC] Message:', event.message);

          const cardData: NFCCardData = {
            uid: event.serialNumber,
          };

          // Try to read NDEF messages
          if (event.message && event.message.records) {
            console.log('[NFC] Found', event.message.records.length, 'records');
            
            for (const record of event.message.records) {
              try {
                console.log('[NFC] Processing record type:', record.recordType);
                const decoder = new TextDecoder();
                const text = decoder.decode(record.data);
                console.log('[NFC] Record data:', text);

                // Parse JSON data if available
                if (record.recordType === 'text' || record.recordType === 'application/json') {
                  try {
                    const jsonData = JSON.parse(text);
                    console.log('[NFC] Parsed JSON data:', jsonData);
                    Object.assign(cardData, jsonData);
                  } catch {
                    // If not JSON, might be plain address
                    if (text.startsWith('0x') || text.startsWith('inj1')) {
                      console.log('[NFC] Found plain address:', text);
                      cardData.address = text;
                    }
                  }
                }
              } catch (e) {
                console.warn('[NFC] Failed to decode record:', e);
              }
            }
          } else {
            console.log('[NFC] No NDEF message found on card (empty card)');
          }

          console.log('[NFC] Final card data:', cardData);
          resolve(cardData);
        };

        ndef.onreadingerror = (error: any) => {
          clearTimeout(timeout);
          console.error('[NFC] Reading error:', error);
          reject(new Error('Failed to read NFC card - please try again'));
        };
      }).catch((error: any) => {
        clearTimeout(timeout);
        console.error('[NFC] Scan start error:', error);
        
        if (error.name === 'NotAllowedError') {
          reject(new Error('NFC permission denied. Please allow NFC access and try again.'));
        } else {
          reject(new Error(`NFC scan failed: ${error.message || 'Unknown error'}`));
        }
      });
    });
  } catch (error) {
    console.error('[NFC] Read error:', error);
    throw error;
  }
}

/**
 * Write data to NFC card
 * Stores wallet address and card info on the NFC tag
 */
export async function writeNFCCard(data: Omit<NFCCardData, 'uid'>): Promise<void> {
  if (!isNFCSupported()) {
    throw new Error('NFC is not supported on this device. Please use Android Chrome.');
  }

  try {
    const ndef = new (window as any).NDEFReader();
    console.log('[NFC] Starting NFC write...');
    console.log('[NFC] Data to write:', data);

    const jsonData = JSON.stringify(data);
    console.log('[NFC] JSON payload:', jsonData);

    await ndef.write({
      records: [
        {
          recordType: "text",
          data: jsonData,
        }
      ]
    });

    console.log('[NFC] Write successful!');
  } catch (error: any) {
    console.error('[NFC] Write error:', error);
    
    if (error.name === 'NotAllowedError') {
      throw new Error('NFC permission denied. Please allow NFC access and try again.');
    } else if (error.name === 'NotSupportedError') {
      throw new Error('This NFC card type is not supported for writing.');
    } else if (error.name === 'NetworkError') {
      throw new Error('Failed to write to NFC card. Please try again.');
    } else {
      throw new Error(`NFC write failed: ${error.message || 'Unknown error'}`);
    }
  }
}

/**
 * Write only address to NFC card (simplified)
 */
export async function writeAddressToNFC(address: string): Promise<void> {
  if (!isNFCSupported()) {
    throw new Error('NFC is not supported on this device. Please use Android Chrome.');
  }

  try {
    const ndef = new (window as any).NDEFReader();
    console.log('[NFC] Writing address to card:', address);

    await ndef.write({
      records: [
        {
          recordType: "text",
          data: address,
        }
      ]
    });

    console.log('[NFC] Address written successfully!');
  } catch (error: any) {
    console.error('[NFC] Write error:', error);
    
    if (error.name === 'NotAllowedError') {
      throw new Error('NFC permission denied. Please allow NFC access and try again.');
    } else {
      throw new Error(`Failed to write address: ${error.message || 'Unknown error'}`);
    }
  }
}

/**
 * Cancel ongoing NFC operation
 */
export async function cancelNFC(): Promise<void> {
  // Web NFC API doesn't have explicit cancel
  // Operations timeout automatically
  console.log('[NFC] NFC operation cancelled');
}
