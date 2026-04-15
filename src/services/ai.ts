import { getAuthToken, refreshToken } from './passkey';
import { API_BASE_URL } from './api-base';

export interface AgentUiMessage {
  role: 'assistant' | 'tool';
  content: string;
  isError?: boolean;
}

export interface AgentPendingConfirmation {
  toolUseId?: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  executionMode?: 'backend_sandbox' | 'client_wallet';
}

export interface StoredConversationSummary {
  id: string;
  title: string | null;
  model: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredConversationMessage {
  id: number;
  conversationId: string;
  role: string;
  content: string;
  toolUse?: unknown;
  toolResult?: unknown;
  createdAt: string;
}

export interface StoredConversationDetail {
  conversation: StoredConversationSummary;
  messages: StoredConversationMessage[];
}

export interface AgentChatResponse {
  ok: boolean;
  conversationId?: string;
  sandboxAddress?: string | null;
  messages?: AgentUiMessage[];
  pendingConfirmation?: AgentPendingConfirmation | null;
  error?: string;
}

export interface AgentSweepResponse {
  ok: boolean;
  conversationId?: string;
  sandboxAddress?: string | null;
  result?: {
    sandboxAddress: string;
    recipientAddress: string;
    transfers: Array<{
      symbol: 'INJ' | 'USDT' | 'USDC';
      amount: string;
      txHash: string;
      explorerUrl: string;
    }>;
    empty: boolean;
    balancesBefore: {
      INJ: string;
      USDT: string;
      USDC: string;
    };
  };
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Agent Bridge APIs ───────────────────────────────────────────────────────

export async function sendAgentMessage(request: {
  conversationId?: string;
  message: string;
  model?: string;
  sandboxMode?: boolean;
}): Promise<AgentChatResponse> {
  try {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/ai/agent/chat`, {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Agent chat failed' }));
      return {
        ok: false,
        error: error.error || error.message || 'Agent chat failed',
      };
    }

    return response.json();
  } catch (error) {
    console.error('[AI] Agent chat failed:', error);
    return {
      ok: false,
      error: 'Network error',
    };
  }
}

export async function getStoredAgentConversations(): Promise<StoredConversationSummary[]> {
  try {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/ai/conversations`, {
      method: 'GET',
    });

    if (!response.ok) {
      return [];
    }

    return response.json();
  } catch (error) {
    console.error('[AI] Get stored conversations failed:', error);
    return [];
  }
}

export async function getStoredAgentConversation(
  conversationId: string,
): Promise<StoredConversationDetail | null> {
  try {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/ai/conversations/${conversationId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('[AI] Get stored conversation failed:', error);
    return null;
  }
}

export async function confirmAgentAction(request: {
  conversationId: string;
  approve: boolean;
}): Promise<AgentChatResponse> {
  try {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/ai/agent/confirm`, {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Agent confirmation failed' }));
      return {
        ok: false,
        error: error.error || error.message || 'Agent confirmation failed',
      };
    }

    return response.json();
  } catch (error) {
    console.error('[AI] Agent confirmation failed:', error);
    return {
      ok: false,
      error: 'Network error',
    };
  }
}

export async function submitClientToolResult(request: {
  conversationId: string;
  toolUseId: string;
  result: string;
}): Promise<AgentChatResponse> {
  try {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/ai/agent/client-tool-result`, {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Client tool result submit failed' }));
      return {
        ok: false,
        error: error.error || error.message || 'Client tool result submit failed',
      };
    }

    return response.json();
  } catch (error) {
    console.error('[AI] Client tool result submit failed:', error);
    return {
      ok: false,
      error: 'Network error',
    };
  }
}

export async function sweepAgentSandbox(request: {
  conversationId: string;
}): Promise<AgentSweepResponse> {
  try {
    const response = await fetchWithAuthRetry(`${API_BASE_URL}/ai/agent/sweep`, {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Sandbox sweep failed' }));
      return {
        ok: false,
        error: error.error || error.message || 'Sandbox sweep failed',
      };
    }

    return response.json();
  } catch (error) {
    console.error('[AI] Sandbox sweep failed:', error);
    return {
      ok: false,
      error: 'Network error',
    };
  }
}
