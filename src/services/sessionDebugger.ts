/**
 * Session Debugger Utility
 * Helper functions for debugging session token issues during development
 * 
 * Usage in browser console:
 *   import { SessionDebugger } from '@/services/sessionDebugger';
 *   SessionDebugger.logSessionInfo();
 *   SessionDebugger.forceExpire();
 */

import { getSessionToken, clearSessionToken, saveSessionToken } from './session';

export const SessionDebugger = {
  /**
   * Log current session information to console
   */
  logSessionInfo(): void {
    console.group('📊 Session Debug Info');
    
    const session = getSessionToken();
    
    if (!session) {
      console.log('❌ No session token found');
      console.groupEnd();
      return;
    }
    
    const now = Date.now();
    const timeRemaining = session.expiresAt - now;
    const minutesRemaining = Math.floor(timeRemaining / 1000 / 60);
    const secondsRemaining = Math.floor((timeRemaining / 1000) % 60);
    
    console.log('✅ Session exists');
    console.log('Token:', session.token.substring(0, 20) + '...');
    console.log('Address:', session.address);
    console.log('Created:', new Date(session.expiresAt - 30 * 60 * 1000).toLocaleString());
    console.log('Expires:', new Date(session.expiresAt).toLocaleString());
    console.log(`Time Remaining: ${minutesRemaining}m ${secondsRemaining}s`);
    console.log('Is Valid:', timeRemaining > 0);
    
    if (timeRemaining < 5 * 60 * 1000) {
      console.warn('⚠️ Session expires in less than 5 minutes');
    }
    
    console.groupEnd();
  },

  /**
   * Force session to expire (for testing)
   */
  forceExpire(): void {
    const session = getSessionToken();
    
    if (!session) {
      console.log('❌ No session to expire');
      return;
    }
    
    session.expiresAt = Date.now() - 1000;
    localStorage.setItem('wallet_session_token', JSON.stringify(session));
    console.log('✅ Session expired. Wait up to 60 seconds for auto-lock.');
  },

  /**
   * Extend session by N minutes (for testing)
   */
  extendSession(minutes: number = 30): void {
    const session = getSessionToken();
    
    if (!session) {
      console.log('❌ No session to extend');
      return;
    }
    
    session.expiresAt = Date.now() + (minutes * 60 * 1000);
    localStorage.setItem('wallet_session_token', JSON.stringify(session));
    console.log(`✅ Session extended by ${minutes} minutes`);
    this.logSessionInfo();
  },

  /**
   * Create a mock session (for testing without backend)
   */
  createMockSession(address: string = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'): void {
    const mockToken = 'mock_token_' + Math.random().toString(36).substring(7);
    saveSessionToken(mockToken, address);
    console.log('✅ Mock session created');
    this.logSessionInfo();
  },

  /**
   * Clear session
   */
  clear(): void {
    clearSessionToken();
    console.log('✅ Session cleared');
  },

  /**
   * Get raw session data
   */
  getRawSession(): string | null {
    return localStorage.getItem('wallet_session_token');
  },

  /**
   * Validate session token format
   */
  validateFormat(): boolean {
    const raw = this.getRawSession();
    
    if (!raw) {
      console.log('❌ No session found');
      return false;
    }
    
    try {
      const session = JSON.parse(raw);
      const hasToken = typeof session.token === 'string';
      const hasExpiry = typeof session.expiresAt === 'number';
      const hasAddress = typeof session.address === 'string';
      
      console.group('🔍 Session Format Validation');
      console.log('Has token:', hasToken ? '✅' : '❌');
      console.log('Has expiresAt:', hasExpiry ? '✅' : '❌');
      console.log('Has address:', hasAddress ? '✅' : '❌');
      console.log('Valid format:', hasToken && hasExpiry && hasAddress ? '✅' : '❌');
      console.groupEnd();
      
      return hasToken && hasExpiry && hasAddress;
    } catch (error) {
      console.error('❌ Invalid JSON format:', error);
      return false;
    }
  },

  /**
   * Monitor session in real-time
   */
  startMonitoring(intervalSeconds: number = 10): () => void {
    console.log(`🔄 Starting session monitor (interval: ${intervalSeconds}s)`);
    console.log('Call the returned function to stop monitoring');
    
    const intervalId = setInterval(() => {
      const session = getSessionToken();
      if (!session) {
        console.log('⏰', new Date().toLocaleTimeString(), '- No session');
        return;
      }
      
      const timeRemaining = session.expiresAt - Date.now();
      const minutesRemaining = Math.floor(timeRemaining / 1000 / 60);
      const secondsRemaining = Math.floor((timeRemaining / 1000) % 60);
      
      console.log(
        '⏰',
        new Date().toLocaleTimeString(),
        `-`,
        `${minutesRemaining}m ${secondsRemaining}s remaining`
      );
    }, intervalSeconds * 1000);
    
    return () => {
      clearInterval(intervalId);
      console.log('⏹️ Session monitor stopped');
    };
  },

  /**
   * Run all diagnostics
   */
  runDiagnostics(): void {
    console.group('🔧 Session Diagnostics');
    this.validateFormat();
    this.logSessionInfo();
    
    // Check API URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    console.log('API URL:', apiUrl || '❌ Not configured');
    
    // Check localStorage availability
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      console.log('LocalStorage:', '✅ Available');
    } catch (e) {
      console.log('LocalStorage:', '❌ Unavailable');
    }
    
    console.groupEnd();
  },
};

// Make available in browser console during development
if (typeof window !== 'undefined') {
  (window as any).SessionDebugger = SessionDebugger;
}
