/**
 * @injpass/connector - Lightweight SDK for embedding INJ Pass wallet
 * 
 * This SDK allows dApps to easily integrate INJ Pass wallet via iframe
 * without dealing with postMessage complexity.
 * 
 * ⚡ New Architecture (v2.0):
 * - Uses popup windows for Passkey authentication (bypasses iframe restrictions)
 * - No longer requires Storage Access API
 * - Works seamlessly across all browsers (Safari, Chrome, Firefox)
 * - Fully compatible with Storage Partitioning
 */

export interface InjPassConfig {
  /**
   * URL of the INJ Pass embed page (REQUIRED)
   * 
   * Development: http://localhost:3001/embed
   * Production: Your deployed INJ Pass URL + /embed
   * 
   * @example
   * ```typescript
   * // Development
   * embedUrl: 'http://localhost:3001/embed'
   * 
   * // Production (Vercel)
   * embedUrl: 'https://your-app.vercel.app/embed'
   * ```
   */
  embedUrl: string;

  /**
   * Position of the iframe
   * @default { bottom: '20px', right: '20px' }
   */
  position?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };

  /**
   * Size of the iframe
   * @default { width: '400px', height: '300px' }
   */
  size?: {
    width: string;
    height: string;
  };

  /**
   * Display mode
   * - 'floating': Fixed position overlay
   * - 'modal': Full-screen modal
   * - 'inline': Embedded in container
   * @default 'floating'
   */
  mode?: 'floating' | 'modal' | 'inline';

  /**
   * Container element ID for inline mode
   */
  containerId?: string;

  /**
   * Auto-hide iframe when connected
   * @default true
   */
  autoHide?: boolean;
}

export interface ConnectedWallet {
  address: string;
  walletName?: string;
  signer: InjPassSigner;
}

export class InjPassConnector {
  private iframe: HTMLIFrameElement | null = null;
  private config: Required<Omit<InjPassConfig, 'containerId'>> & Pick<InjPassConfig, 'containerId'>;
  private connected = false;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }>();
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private disconnectListeners: Set<() => void> = new Set();

  constructor(config: InjPassConfig) {
    if (!config.embedUrl) {
      throw new Error(
        'embedUrl is required. Please provide the INJ Pass embed URL.\n' +
        'Example: { embedUrl: "http://localhost:3001/embed" }'
      );
    }

    this.config = {
      embedUrl: config.embedUrl,
      position: config.position || { bottom: '20px', right: '20px' },
      size: config.size || { width: '400px', height: '300px' },
      mode: config.mode || 'floating',
      autoHide: config.autoHide !== undefined ? config.autoHide : true,
      containerId: config.containerId,
    };
  }

  /**
   * Connect to INJ Pass wallet
   * 
   * ⚡ How it works (New Architecture):
   * 1. SDK creates an iframe with INJ Pass embed page
   * 2. User clicks "Connect" in the iframe
   * 3. A popup window opens for Passkey authentication
   * 4. User authenticates with biometrics in the popup
   * 5. Popup closes and sends wallet info back to iframe
   * 6. Iframe forwards the info to your dApp
   * 
   * This popup approach bypasses browser restrictions on:
   * - Storage Access in iframes
   * - WebAuthn in cross-origin iframes
   * - Third-party cookie blocking
   */
  async connect(): Promise<ConnectedWallet> {
    if (this.connected) {
      throw new Error('Already connected');
    }

    // Create iframe
    this.createIframe();

    // Wait for connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
        this.disconnect();
      }, 60000); // 60 second timeout

      this.messageHandler = (event: MessageEvent) => {
        if (event.origin !== new URL(this.config.embedUrl).origin) {
          return; // Ignore messages from other origins
        }

        const { type, address, walletName, error } = event.data;

        if (type === 'INJPASS_CONNECTED') {
          clearTimeout(timeout);
          this.connected = true;

          // Don't hide — the embed page shrinks itself to a ball
          const signer = new InjPassSigner(this.iframe!, this.config.embedUrl);
          
          resolve({
            address,
            walletName,
            signer,
          });
        }

        // Embed page requests iframe resize (ball ↔ card)
        if (type === 'INJPASS_RESIZE' && this.iframe) {
          const { width, height } = event.data;
          this.iframe.style.width = `${width}px`;
          this.iframe.style.height = `${height}px`;
          this.iframe.style.borderRadius = (width <= 80 && height <= 80) ? '50%' : '16px';
          // Reveal on first resize message, and enable hover/click
          this.iframe.style.opacity = '1';
          this.iframe.style.pointerEvents = 'auto';
        }

        if (type === 'INJPASS_ERROR') {
          clearTimeout(timeout);
          reject(new Error(error || 'Connection failed'));
          this.disconnect();
        }

        if (type === 'INJPASS_SIGN_RESPONSE') {
          const pending = this.pendingRequests.get(event.data.requestId);
          if (pending) {
            if (event.data.error) {
              pending.reject(new Error(event.data.error));
            } else {
              pending.resolve(event.data.signature);
            }
            this.pendingRequests.delete(event.data.requestId);
          }
        }

        // Handle disconnect from embed page (when user clicks Disconnect in embed)
        if (type === 'INJPASS_DISCONNECTED') {
          this.disconnect();
        }
      };

      window.addEventListener('message', this.messageHandler);
    });
  }

  /**
   * Disconnect from wallet
   */
  disconnect(): void {
    if (this.iframe) {
      this.iframe.contentWindow?.postMessage({ type: 'INJPASS_DISCONNECT' }, this.config.embedUrl);
      this.iframe.remove();
      this.iframe = null;
    }

    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }

    this.connected = false;
    this.pendingRequests.clear();

    // Notify all disconnect listeners
    this.notifyDisconnectListeners();
  }

  /**
   * Subscribe to disconnect events
   */
  onDisconnect(listener: () => void): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  /**
   * Notify all listeners when disconnected
   */
  private notifyDisconnectListeners(): void {
    this.disconnectListeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in disconnect listener:', error);
      }
    });
  }

  /**
   * Show the iframe (if hidden)
   */
  show(): void {
    if (this.iframe) {
      this.iframe.style.display = 'block';
    }
  }

  /**
   * Hide the iframe
   */
  hide(): void {
    if (this.iframe) {
      this.iframe.style.display = 'none';
    }
  }

  private createIframe(): void {
    this.iframe = document.createElement('iframe');
    this.iframe.src = this.config.embedUrl;
    
    // Note: We no longer need 'publickey-credentials-get' in iframe
    // because Passkey authentication happens in a popup window
    // This makes the SDK work in all browsers without Storage Access API
    this.iframe.setAttribute('allow', 'publickey-credentials-get *; publickey-credentials-create *');
    
    this.iframe.style.border = 'none';
    this.iframe.style.borderRadius = '16px';
    this.iframe.style.boxShadow = 'none';
    this.iframe.style.background = 'transparent';
    this.iframe.style.backgroundColor = 'transparent';
    // 关键：初始尺寸为 0，且 pointerEvents 为 none，防止挡住页面
    this.iframe.style.width = '0px';
    this.iframe.style.height = '0px';
    this.iframe.style.opacity = '0';
    this.iframe.style.pointerEvents = 'none';
    this.iframe.style.zIndex = '9999';
    this.iframe.style.transition = 'width 0.25s ease, height 0.25s ease, border-radius 0.25s ease, opacity 0.15s ease';
    this.iframe.style.overflow = 'hidden';
    this.iframe.setAttribute('allowtransparency', 'true');

    if (this.config.mode === 'floating') {
      this.iframe.style.position = 'fixed';
      Object.entries(this.config.position).forEach(([key, value]) => {
        (this.iframe!.style as any)[key] = value;
      });
      // ⚠️ DO NOT set width/height here for floating mode!
      // The embed page controls size via INJPASS_RESIZE messages
      // iframe starts at 0×0 opacity:0, then embed page resizes it
      document.body.appendChild(this.iframe);
    } else if (this.config.mode === 'modal') {
      this.iframe.style.position = 'fixed';
      this.iframe.style.top = '50%';
      this.iframe.style.left = '50%';
      this.iframe.style.transform = 'translate(-50%, -50%)';
      this.iframe.style.width = this.config.size.width;
      this.iframe.style.height = this.config.size.height;
      
      // Add backdrop
      const backdrop = document.createElement('div');
      backdrop.style.position = 'fixed';
      backdrop.style.top = '0';
      backdrop.style.left = '0';
      backdrop.style.width = '100vw';
      backdrop.style.height = '100vh';
      backdrop.style.backgroundColor = 'rgba(0,0,0,0.5)';
      backdrop.style.zIndex = '9998';
      backdrop.id = 'injpass-backdrop';
      document.body.appendChild(backdrop);
      document.body.appendChild(this.iframe);
    } else if (this.config.mode === 'inline' && this.config.containerId) {
      const container = document.getElementById(this.config.containerId);
      if (!container) {
        throw new Error(`Container #${this.config.containerId} not found`);
      }
      this.iframe.style.width = '100%';
      this.iframe.style.height = '100%';
      container.appendChild(this.iframe);
    }
  }
}

class InjPassSigner {
  private requestCounter = 0;

  constructor(
    private iframe: HTMLIFrameElement,
    private targetOrigin: string
  ) {}

  /**
   * Sign a message
   * 
   * ⚡ How it works (New Architecture):
   * 1. SDK sends sign request to iframe
   * 2. Iframe opens a popup window for authentication
   * 3. User authenticates with Passkey in the popup
   * 4. Popup signs the message and sends result back
   * 5. Result is forwarded to your dApp
   * 
   * This ensures security while bypassing iframe limitations
   */
  async signMessage(message: string): Promise<Uint8Array> {
    const requestId = `sign_${++this.requestCounter}_${Date.now()}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Signing timeout'));
      }, 30000);

      const handler = (event: MessageEvent) => {
        if (event.data.type === 'INJPASS_SIGN_RESPONSE' && event.data.requestId === requestId) {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);

          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(new Uint8Array(event.data.signature));
          }
        }
      };

      window.addEventListener('message', handler);

      this.iframe.contentWindow?.postMessage({
        type: 'INJPASS_SIGN_REQUEST',
        data: {
          id: requestId,
          message,
        },
      }, this.targetOrigin);
    });
  }
}
