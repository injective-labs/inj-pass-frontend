import { getAuthToken, refreshToken } from './passkey';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_URL environment variable is required');
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ToolUse {
  name: string;
  input?: Record<string, any>;
  id: string;
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content?: string;
  tool_use?: ToolUse[];
  tool_result?: ToolResult[];
}

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
}

export interface ChatRecordRequest {
  conversationId?: string;
  title?: string;
  messages: ChatMessage[];
  model: string;
  usage: UsageInfo;
}

export interface CostInfo {
  inputTokens: number;
  outputTokens: number;
  ninjiaDeducted: number;
  currency: number;
}

export interface ChatRecordResponse {
  ok: boolean;
  conversationId: string;
  balance: number;
  cost?: CostInfo;
  error?: string;
  current?: number;
  required?: number;
}

export interface SyncConversationRequest {
  conversationId: string;
  messages: ChatMessage[];
}

export interface Conversation {
  id: string;
  title: string;
  model: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: number;
  conversationId: string;
  role: string;
  content: string;
  toolUse: any;
  toolResult: any;
  createdAt: Date;
}

export interface ConversationDetail {
  conversation: Conversation;
  messages: Message[];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Get auth header with Bearer token
 */
function getAuthHeader(token?: string | null): HeadersInit {
  const authToken = token ?? getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
  };
}

async function fetchWithAuthRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const token = getAuthToken();
  const firstResponse = await fetch(url, {
    ...init,
    headers: {
      ...getAuthHeader(token),
      ...(init.headers || {}),
    },
  });

  if (firstResponse.status !== 401 || !token) {
    return firstResponse;
  }

  const newToken = await refreshToken(token);
  if (!newToken) {
    return firstResponse;
  }

  return fetch(url, {
    ...init,
    headers: {
      ...getAuthHeader(newToken),
      ...(init.headers || {}),
    },
  });
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Record chat from frontend (frontend executes tools, backend records and charges)
 * This should be called after each AI conversation turn
 */
export async function recordChat(request: ChatRecordRequest): Promise<ChatRecordResponse> {
  try {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/ai/chat/record`, {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (response.status === 401) {
      return {
        ok: false,
        conversationId: request.conversationId || '',
        balance: 0,
        error: 'Unauthorized',
      };
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Record failed' }));
      return {
        ok: false,
        conversationId: request.conversationId || '',
        balance: 0,
        error: error.error || error.message || 'Record failed',
      };
    }

    const result = await response.json();
    if (result?.ok === false && result?.error === 'Unauthorized') {
      return {
        ok: false,
        conversationId: request.conversationId || '',
        balance: 0,
        error: 'Unauthorized',
      };
    }

    return result;
  } catch (error) {
    console.error('[AI] Record chat failed:', error);
    return {
      ok: false,
      conversationId: request.conversationId || '',
      balance: 0,
      error: 'Network error',
    };
  }
}

/**
 * Sync conversation body to backend
 * This is called after AI responds to backup the conversation
 */
export async function syncConversation(request: SyncConversationRequest): Promise<{ success: boolean }> {
  try {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/ai/sync-body`, {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      return { success: false };
    }

    return response.json();
  } catch (error) {
    console.error('[AI] Sync conversation failed:', error);
    return { success: false };
  }
}

/**
 * Get conversation list
 */
export async function getConversations(): Promise<Conversation[]> {
  try {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/ai/conversations`, {
      method: 'GET',
    });

    if (!response.ok) {
      return [];
    }

    return response.json();
  } catch (error) {
    console.error('[AI] Get conversations failed:', error);
    return [];
  }
}

/**
 * Get conversation by ID
 */
export async function getConversation(conversationId: string): Promise<ConversationDetail | null> {
  try {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/ai/conversations/${conversationId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('[AI] Get conversation failed:', error);
    return null;
  }
}

/**
 * Delete conversation
 */
export async function deleteConversation(conversationId: string): Promise<boolean> {
  try {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/ai/conversations/${conversationId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('[AI] Delete conversation failed:', error);
    return false;
  }
}
