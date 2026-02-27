'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { getTokenBalances, executeSwap, getSwapQuote } from '@/services/dex-swap';
import { sendTransaction } from '@/wallet/chain/evm/sendTransaction';
import { getTxHistory } from '@/wallet/chain/evm/getTxHistory';
import { privateKeyToHex } from '@/utils/wallet';
import type { Address } from 'viem';

// ─── Types ─────────────────────────────────────────────────────────────────

type Model = 'claude-sonnet-4-5' | 'claude-sonnet-4-6';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool_result';
  content: string;
  isError?: boolean;
  isPending?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
}

// A pending tool call waiting for user confirmation
interface PendingTool {
  tool_use_id: string;
  name: string;
  input: Record<string, unknown>;
}

const MODEL_OPTIONS: { value: Model; label: string }[] = [
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
];

const STORAGE_KEY = 'injpass_agent_conversations';

// ─── Helpers ───────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  } catch {
    // storage full — ignore
  }
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function AgentsPage() {
  const router = useRouter();
  const { isUnlocked, address, privateKey, isCheckingSession } = useWallet();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<Model>('claude-sonnet-4-6');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingTool, setPendingTool] = useState<PendingTool | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Active conversation derived from list
  const activeConv = conversations.find((c) => c.id === activeId) ?? null;
  const messages = activeConv?.messages ?? [];

  // ── Auth guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCheckingSession && (!isUnlocked || !address)) {
      router.push('/welcome');
    }
  }, [isUnlocked, address, isCheckingSession, router]);

  // ── Load persisted history ──────────────────────────────────────────────
  useEffect(() => {
    const saved = loadConversations();
    setConversations(saved);
    if (saved.length > 0) setActiveId(saved[0].id);
  }, []);

  // ── Auto-scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Textarea auto-resize ────────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [input]);

  // ── Persist conversations whenever they change ──────────────────────────
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  // ─── Conversation management ────────────────────────────────────────────

  function newConversation() {
    const id = uid();
    const conv: Conversation = { id, title: 'New chat', createdAt: Date.now(), messages: [] };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(id);
    setSidebarOpen(false);
  }

  function deleteConversation(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      setActiveId(remaining.length > 0 ? remaining[0].id : null);
    }
  }

  function updateMessages(id: string, updater: (msgs: ChatMessage[]) => ChatMessage[]) {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, messages: updater(c.messages) } : c))
    );
  }

  function setTitle(id: string, title: string) {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: title.slice(0, 40) } : c))
    );
  }

  // ─── Tool execution (client-side, private key never leaves browser) ──────

  async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    if (!address) return JSON.stringify({ error: 'Wallet not connected' });

    try {
      if (name === 'get_balance') {
        const balances = await getTokenBalances(['INJ', 'USDT', 'USDC'], address as Address);
        return JSON.stringify({ INJ: balances.INJ, USDT: balances.USDT, USDC: balances.USDC });
      }

      if (name === 'get_swap_quote') {
        const { fromToken, toToken, amount, slippage = 0.5 } = input as {
          fromToken: string;
          toToken: string;
          amount: string;
          slippage?: number;
        };
        const quote = await getSwapQuote(fromToken, toToken, amount, Number(slippage));
        return JSON.stringify({
          fromToken: quote.fromToken,
          toToken: quote.toToken,
          amountIn: quote.amountIn,
          expectedOutput: quote.expectedOutput,
          minOutput: quote.minOutput,
          priceImpact: quote.priceImpact,
          route: quote.route,
        });
      }

      if (name === 'execute_swap') {
        if (!privateKey) return JSON.stringify({ error: 'Wallet locked' });
        const { fromToken, toToken, amount, slippage = 0.5 } = input as {
          fromToken: string;
          toToken: string;
          amount: string;
          slippage?: number;
        };
        const pkHex = privateKeyToHex(privateKey);
        const txHash = await executeSwap({
          fromToken,
          toToken,
          amountIn: amount,
          slippage: Number(slippage),
          userAddress: address as Address,
          privateKey: pkHex,
        });
        return JSON.stringify({
          success: true,
          txHash,
          explorerUrl: `https://blockscout.injective.network/tx/${txHash}`,
        });
      }

      if (name === 'send_token') {
        if (!privateKey) return JSON.stringify({ error: 'Wallet locked' });
        const { toAddress, amount } = input as { toAddress: string; amount: string };
        const txHash = await sendTransaction(privateKey, toAddress, amount);
        return JSON.stringify({
          success: true,
          txHash,
          explorerUrl: `https://blockscout.injective.network/tx/${txHash}`,
        });
      }

      if (name === 'get_tx_history') {
        const limit = (input.limit as number) ?? 10;
        const history = await getTxHistory(address, limit);
        return JSON.stringify(history);
      }

      return JSON.stringify({ error: `Unknown tool: ${name}` });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  }

  // ─── Core chat loop ─────────────────────────────────────────────────────

  const runAgentLoop = useCallback(
    async (convId: string, currentMessages: ChatMessage[]) => {
      setIsStreaming(true);

      // Build API message format (skip tool_result pseudo-messages for display only)
      const apiMessages = currentMessages
        .filter((m) => m.role !== 'tool_result')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      try {
        const res = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages, model }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? 'API error');
        }

        const data = await res.json();

        // Extract text and tool_use blocks
        const textBlocks: string[] = [];
        const toolBlocks: { id: string; name: string; input: Record<string, unknown> }[] = [];

        for (const block of data.content ?? []) {
          if (block.type === 'text') textBlocks.push(block.text);
          if (block.type === 'tool_use') toolBlocks.push({ id: block.id, name: block.name, input: block.input });
        }

        const assistantText = textBlocks.join('\n').trim();

        if (assistantText) {
          const assistantMsg: ChatMessage = { id: uid(), role: 'assistant', content: assistantText };
          updateMessages(convId, (msgs) => [...msgs, assistantMsg]);
        }

        // If there are tool calls
        if (toolBlocks.length > 0) {
          const tool = toolBlocks[0]; // Handle one at a time
          const isDestructive = tool.name === 'execute_swap' || tool.name === 'send_token';
          // get_swap_quote, get_balance, get_tx_history are all safe to run immediately

          if (isDestructive) {
            // Ask user to confirm before executing
            setPendingTool({ tool_use_id: tool.id, name: tool.name, input: tool.input });
            setIsStreaming(false);
            return;
          }

          // Non-destructive: execute immediately
          const toolResultContent = await executeTool(tool.name, tool.input);
          const displayMsg: ChatMessage = {
            id: uid(),
            role: 'tool_result',
            content: `🔧 **${tool.name}** result:\n\`\`\`json\n${JSON.stringify(JSON.parse(toolResultContent), null, 2)}\n\`\`\``,
          };
          const updatedMessages = [...currentMessages, displayMsg];
          updateMessages(convId, () => updatedMessages);

          // Send tool result back to Claude
          const toolResultRes = await fetch('/api/agents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: apiMessages.concat([{ role: 'assistant', content: data.content }]),
              model,
              toolResults: [{ tool_use_id: tool.id, content: toolResultContent }],
            }),
          });

          if (!toolResultRes.ok) throw new Error('Tool result API error');
          const toolResultData = await toolResultRes.json();

          const finalText = (toolResultData.content ?? [])
            .filter((b: { type: string }) => b.type === 'text')
            .map((b: { text: string }) => b.text)
            .join('\n')
            .trim();

          if (finalText) {
            updateMessages(convId, (msgs) => [
              ...msgs,
              { id: uid(), role: 'assistant', content: finalText },
            ]);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        updateMessages(convId, (msgs) => [
          ...msgs,
          { id: uid(), role: 'assistant', content: `❌ Error: ${msg}`, isError: true },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [model]
  );

  // ─── Confirm destructive tool ────────────────────────────────────────────

  async function handleToolConfirm() {
    if (!pendingTool || !activeId) return;
    setConfirmLoading(true);

    const toolResultContent = await executeTool(pendingTool.name, pendingTool.input);
    const parsed = JSON.parse(toolResultContent);
    const isSuccess = !parsed.error;

    const displayMsg: ChatMessage = {
      id: uid(),
      role: 'tool_result',
      content: isSuccess
        ? `✅ **${pendingTool.name}** executed\nTx Hash: \`${parsed.txHash}\``
        : `❌ **${pendingTool.name}** failed: ${parsed.error}`,
    };

    const currentMsgs = conversations.find((c) => c.id === activeId)?.messages ?? [];
    const apiMsgs = currentMsgs
      .filter((m) => m.role !== 'tool_result')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    updateMessages(activeId, (msgs) => [...msgs, displayMsg]);

    // Send tool result back to Claude for final response
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMsgs,
          model,
          toolResults: [{ tool_use_id: pendingTool.tool_use_id, content: toolResultContent }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const finalText = (data.content ?? [])
          .filter((b: { type: string }) => b.type === 'text')
          .map((b: { text: string }) => b.text)
          .join('\n')
          .trim();
        if (finalText) {
          updateMessages(activeId, (msgs) => [
            ...msgs,
            { id: uid(), role: 'assistant', content: finalText },
          ]);
        }
      }
    } catch {
      // ignore
    }

    setPendingTool(null);
    setConfirmLoading(false);
  }

  function handleToolCancel() {
    if (!activeId) return;
    updateMessages(activeId, (msgs) => [
      ...msgs,
      { id: uid(), role: 'assistant', content: '🚫 Operation cancelled.' },
    ]);
    setPendingTool(null);
  }

  // ─── Send message ────────────────────────────────────────────────────────

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput('');

    let convId = activeId;

    // Create a new conversation if none active
    if (!convId) {
      const id = uid();
      const conv: Conversation = { id, title: text.slice(0, 40), createdAt: Date.now(), messages: [] };
      setConversations((prev) => [conv, ...prev]);
      setActiveId(id);
      convId = id;
    } else if (messages.length === 0) {
      setTitle(convId, text);
    }

    const userMsg: ChatMessage = { id: uid(), role: 'user', content: text };
    let updatedMessages: ChatMessage[] = [];
    updateMessages(convId, (msgs) => {
      updatedMessages = [...msgs, userMsg];
      return updatedMessages;
    });

    // Small delay to ensure state update
    await new Promise((r) => setTimeout(r, 50));
    const conv = conversations.find((c) => c.id === convId);
    const msgsForApi = conv ? [...conv.messages, userMsg] : [userMsg];
    await runAgentLoop(convId, msgsForApi);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ─── Render helpers ──────────────────────────────────────────────────────

  function renderMessageContent(content: string) {
    // Basic markdown-ish rendering: code blocks, bold, inline code
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inCode = false;
    let codeLines: string[] = [];
    let keyIdx = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('```')) {
        if (!inCode) {
          inCode = true;
          codeLines = [];
        } else {
          elements.push(
            <pre key={keyIdx++} className="bg-white/5 border border-white/10 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono text-green-300 whitespace-pre-wrap">
              {codeLines.join('\n')}
            </pre>
          );
          inCode = false;
        }
        continue;
      }
      if (inCode) {
        codeLines.push(line);
        continue;
      }

      // Render inline formatting
      const rendered = renderInline(line, keyIdx++);
      elements.push(<p key={keyIdx++} className="mb-1 leading-relaxed">{rendered}</p>);
    }

    return <div className="text-sm">{elements}</div>;
  }

  function renderInline(text: string, key: number): React.ReactNode {
    // Handle **bold** and `code`
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="bg-white/10 px-1 rounded text-xs font-mono text-blue-300">{part.slice(1, -1)}</code>;
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

  function toolLabel(name: string, input: Record<string, unknown>) {
    if (name === 'execute_swap') {
      const expected = input.expectedOutput ? ` → ~${Number(input.expectedOutput).toFixed(4)} ${input.toToken}` : ` → ${input.toToken}`;
      return `Swap ${input.amount} ${input.fromToken}${expected}`;
    }
    if (name === 'send_token') {
      return `Send ${input.amount} INJ to ${String(input.toAddress).slice(0, 10)}...${String(input.toAddress).slice(-6)}`;
    }
    return name;
  }

  const TOKEN_ICONS: Record<string, string> = {
    INJ: '/injswap.png',
    USDT: '/USDT_Logo.png',
    USDC: '/USDC_Logo.png',
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  // ─── UI ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">

      {/* ── Sidebar overlay (mobile) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed md:relative z-30 md:z-auto
          top-0 left-0 h-full
          w-72 flex-shrink-0
          bg-[#0a0a0a] border-r border-white/10
          flex flex-col
          transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Sidebar header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
              </svg>
            </div>
            <span className="font-bold text-sm">Agents</span>
          </div>
          <button
            onClick={newConversation}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="New chat"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
          {conversations.length === 0 ? (
            <div className="text-center py-10 text-gray-600 text-xs">
              <p>No conversations yet</p>
              <p className="mt-1">Start a new chat</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                  conv.id === activeId ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
                onClick={() => {
                  setActiveId(conv.id);
                  setSidebarOpen(false);
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <span className="text-xs truncate text-gray-300">{conv.title}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-all flex-shrink-0"
                >
                  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Wallet info at bottom of sidebar */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="2" y="6" width="20" height="14" rx="2" strokeWidth={2} />
                <path d="M2 10h20" strokeWidth={2} strokeLinecap="round" />
                <circle cx="18" cy="15" r="1.5" fill="currentColor" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-mono text-gray-400 truncate">
                {address?.slice(0, 8)}...{address?.slice(-6)}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-xs text-gray-500">Injective Mainnet</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full">

        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/50 backdrop-blur-sm flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors md:hidden"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 text-center">
            <span className="font-semibold text-sm">{activeConv?.title ?? 'New chat'}</span>
          </div>
          <button
            onClick={newConversation}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="New conversation"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            // Welcome screen
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2">INJ Pass Agent</h2>
              <p className="text-gray-400 text-sm max-w-sm mb-8">
                Your AI-powered wallet assistant. Ask me to check balances, swap tokens, send INJ, or explain anything on Injective.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-sm">
                {[
                  'What is my current balance?',
                  'Swap 0.01 INJ to USDT',
                  'Show my recent transactions',
                  'Explain staking on Injective',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion); textareaRef.current?.focus(); }}
                    className="text-left px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-300 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                    msg.role === 'user'
                      ? 'bg-white text-black'
                      : msg.role === 'tool_result'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-white/10 text-gray-300'
                  }`}>
                    {msg.role === 'user' ? 'U' : msg.role === 'tool_result' ? '⚙' : 'AI'}
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-white text-black rounded-tr-sm'
                      : msg.role === 'tool_result'
                      ? 'bg-blue-500/10 border border-blue-500/20 text-blue-100 rounded-tl-sm'
                      : msg.isError
                      ? 'bg-red-500/10 border border-red-500/20 text-red-200 rounded-tl-sm'
                      : 'bg-white/5 border border-white/10 text-gray-100 rounded-tl-sm'
                  }`}>
                    {msg.role === 'user'
                      ? <p className="text-sm">{msg.content}</p>
                      : renderMessageContent(msg.content)
                    }
                  </div>
                </div>
              ))}

              {/* Streaming indicator */}
              {isStreaming && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-gray-300">
                    AI
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1 items-center h-5">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ── Confirmation modal for destructive tools ── */}
        {pendingTool && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-[#111] border border-white/15 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="px-5 pt-5 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Confirm Transaction</h3>
                    <p className="text-xs text-gray-400">AI Agent is requesting approval</p>
                  </div>
                </div>
              </div>

              {/* Swap visual (for execute_swap) */}
              {pendingTool.name === 'execute_swap' && (() => {
                const { fromToken, toToken, amount, expectedOutput } = pendingTool.input as {
                  fromToken: string; toToken: string; amount: string; expectedOutput?: string;
                };
                return (
                  <div className="px-5 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      {/* From */}
                      <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
                        <div className="flex items-center justify-center mb-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={TOKEN_ICONS[fromToken] ?? ''} alt={fromToken} className="w-8 h-8 object-contain" />
                        </div>
                        <div className="text-base font-bold">{amount}</div>
                        <div className="text-xs text-gray-400">{fromToken}</div>
                      </div>
                      {/* Arrow */}
                      <div className="flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </div>
                      {/* To */}
                      <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
                        <div className="flex items-center justify-center mb-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={TOKEN_ICONS[toToken] ?? ''} alt={toToken} className="w-8 h-8 object-contain" />
                        </div>
                        <div className="text-base font-bold">
                          {expectedOutput ? `~${Number(expectedOutput).toFixed(4)}` : '…'}
                        </div>
                        <div className="text-xs text-gray-400">{toToken}</div>
                      </div>
                    </div>
                    {pendingTool.input.slippage != null && (
                      <div className="mt-3 flex justify-between text-xs text-gray-500">
                        <span>Slippage</span>
                        <span>{String(pendingTool.input.slippage)}%</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Send visual (for send_token) */}
              {pendingTool.name === 'send_token' && (() => {
                const { toAddress, amount } = pendingTool.input as { toAddress: string; amount: string };
                return (
                  <div className="px-5 py-4 border-b border-white/10">
                    <div className="text-center mb-3">
                      <div className="flex items-center justify-center mb-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/injswap.png" alt="INJ" className="w-10 h-10 object-contain" />
                      </div>
                      <div className="text-2xl font-bold">{amount} INJ</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                      <div className="text-xs text-gray-400 mb-1">To address</div>
                      <div className="text-xs font-mono text-white break-all">{toAddress}</div>
                    </div>
                  </div>
                );
              })()}

              <div className="px-5 py-3">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-3.5 h-3.5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <p className="text-xs text-gray-400">
                    Private key never leaves your device. Signed locally.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleToolCancel}
                    disabled={confirmLoading}
                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-bold text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleToolConfirm}
                    disabled={confirmLoading}
                    className="flex-1 py-3 rounded-xl bg-white hover:bg-gray-100 text-black font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {confirmLoading ? (
                      <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    ) : null}
                    {confirmLoading ? 'Processing…' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Input area ── */}
        <div className="flex-shrink-0 border-t border-white/10 bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 bg-white/5 border border-white/15 rounded-2xl px-4 py-3 focus-within:border-white/30 transition-colors">
              {/* Model selector */}
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as Model)}
                className="bg-transparent text-xs text-gray-400 border-none outline-none cursor-pointer hover:text-white transition-colors py-1 pr-1 flex-shrink-0"
              >
                {MODEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-black">
                    {opt.label}
                  </option>
                ))}
              </select>

              <div className="w-px h-5 bg-white/15 flex-shrink-0 self-center" />

              {/* Text input */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your wallet…"
                rows={1}
                disabled={isStreaming || !!pendingTool}
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 resize-none outline-none min-h-[24px] max-h-40 py-1 disabled:opacity-50"
              />

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming || !!pendingTool}
                className="w-8 h-8 rounded-xl bg-white hover:bg-gray-100 disabled:bg-white/20 disabled:cursor-not-allowed text-black flex items-center justify-center transition-all flex-shrink-0 self-end"
              >
                {isStreaming ? (
                  <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-center text-xs text-gray-600 mt-2">
              AI can make mistakes. Always verify transactions before confirming.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
