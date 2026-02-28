'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/WalletContext';
import { getTokenBalances, executeSwap, getSwapQuote } from '@/services/dex-swap';
import { sendTransaction } from '@/wallet/chain/evm/sendTransaction';
import { getTxHistory } from '@/wallet/chain/evm/getTxHistory';
import { privateKeyToHex } from '@/utils/wallet';
import { unlockByPasskey } from '@/wallet/key-management/createByPasskey';
import { decryptKey } from '@/wallet/keystore';
import { TOKENS_MAINNET } from '@/services/tokens';
import { privateKeyToAccount } from 'viem/accounts';
import { parseUnits } from 'viem';
import type { Address } from 'viem';

// ─── Types ─────────────────────────────────────────────────────────────────

type Model =
  | 'claude-sonnet-4-5'
  | 'claude-sonnet-4-6'
  | 'gemini-3.1-pro-preview'
  | 'gpt-5.2'
  | 'deepseek-v3.2';

/** Display message shown in the chat UI */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  isError?: boolean;
}

/** Anthropic API message format stored alongside display messages */
interface ApiBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface ApiMessage {
  role: 'user' | 'assistant';
  content: string | ApiBlock[];
}

interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
  apiHistory: ApiMessage[];
  /** Sandbox wallet — only present when sandbox mode was enabled at conversation creation */
  sandboxKey?: string;     // 64-char hex, no 0x prefix
  sandboxAddress?: string; // 0x address
}

/** State while waiting for the user to confirm a destructive tool */
interface PendingConfirmation {
  convId: string;
  toolUseId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  /** The full assistant api message that triggered the tool call */
  assistantApiMessage: ApiMessage;
}

const MODEL_OPTIONS: { value: Model; label: string }[] = [
  { value: 'claude-sonnet-4-6',    label: 'Claude Sonnet 4.6' },
  { value: 'claude-sonnet-4-5',    label: 'Claude Sonnet 4.5' },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
  { value: 'gpt-5.2',             label: 'GPT-5.2' },
  { value: 'deepseek-v3.2',       label: 'DeepSeek V3.2' },
];

const STORAGE_KEY = 'injpass_agent_conversations';
const SANDBOX_MODE_KEY = 'injpass_sandbox_mode';

const TOKEN_ICONS: Record<string, string> = {
  INJ: '/injswap.png',
  USDT: '/USDT_Logo.png',
  USDC: '/USDC_Logo.png',
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    // Normalise old records that pre-date the apiHistory field
    return parsed.map((c) => ({ ...c, apiHistory: Array.isArray(c.apiHistory) ? c.apiHistory : [] }));
  } catch {
    return [];
  }
}

// ─── Sandbox helpers ────────────────────────────────────────────────────────

function isSandboxEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(SANDBOX_MODE_KEY);
  return val === null || val === 'true'; // default: enabled
}

function generateSandboxWallet(): { key: string; addr: string } {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const account = privateKeyToAccount(`0x${hex}` as `0x${string}`);
  return { key: hex, addr: account.address };
}

function hexToUint8(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return bytes;
}

/** ABI-encode an ERC-20 transfer(address,uint256) call */
function encodeERC20Transfer(to: string, amount: bigint): `0x${string}` {
  const paddedTo = to.replace(/^0x/i, '').toLowerCase().padStart(64, '0');
  const paddedAmt = amount.toString(16).padStart(64, '0');
  return `0xa9059cbb${paddedTo}${paddedAmt}` as `0x${string}`;
}

function saveConversations(convs: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  } catch { /* storage full */ }
}

// ─── Hash Mahjong game logic (ported from hash-mahjong-two.vercel.app) ──────

const HM_TILE: Record<string, string> = {
  '0': '🀆', '1': '🀇', '2': '🀈', '3': '🀉', '4': '🀊',
  '5': '🀋', '6': '🀌', '7': '🀍', '8': '🀎', '9': '🀏',
  a: '🀐', b: '🀑', c: '🀒', d: '🀓', e: '🀄', f: '🀅',
};
const HM_GAME_ADDRESS = '0x6cd6592b7d2a9b1e59aa60a6138434d2fe4cd062';
const HM_PLAY_COST    = '0.000001'; // INJ per round

interface HMRule { id: number; name: string; payout: string }

function hmCounts(s: string): Record<string, number> {
  const m: Record<string, number> = {};
  for (const c of s) m[c] = (m[c] || 0) + 1;
  return m;
}
function hmPairs(c: Record<string, number>)   { return Object.values(c).filter(v => v === 2).length; }
function hmTriples(c: Record<string, number>) { return Object.values(c).filter(v => v === 3).length; }
function hmHasAtLeast(c: Record<string, number>, n: number) { return Object.values(c).some(v => v >= n); }
function hmHasExact(c: Record<string, number>, n: number)   { return Object.values(c).some(v => v === n); }
function hmCountExact(c: Record<string, number>, n: number) { return Object.values(c).filter(v => v === n).length; }
function hmHexVal(ch: string) { const v = parseInt(ch, 16); return Number.isFinite(v) ? v : null; }
function hmStraight(s: string, len: number) {
  const a = s.split('').map(hmHexVal);
  for (let i = 0; i <= a.length - len; i++) {
    let asc = true, desc = true;
    for (let j = 1; j < len; j++) {
      if (a[i+j] !== (a[i] as number) + j) asc = false;
      if (a[i+j] !== (a[i] as number) - j) desc = false;
    }
    if (asc || desc) return true;
  }
  return false;
}
function hmDouble4(s: string) {
  const a = s.split('').map(hmHexVal), runs: [number,number][] = [];
  for (let i = 0; i <= 6; i++) {
    let asc = true, desc = true;
    for (let j = 1; j < 4; j++) {
      if (a[i+j] !== (a[i] as number)+j) asc = false;
      if (a[i+j] !== (a[i] as number)-j) desc = false;
    }
    if (asc || desc) runs.push([i, i+3]);
  }
  for (let x = 0; x < runs.length; x++)
    for (let y = x+1; y < runs.length; y++)
      if (runs[x][1] < runs[y][0] || runs[y][1] < runs[x][0]) return true;
  return false;
}

const HM_RULES: { id: number; name: string; payout: string; test: (s: string, c: Record<string,number>) => boolean }[] = [
  { id: 1,  name: 'Tenfold Harmony',   payout: '10000x', test: (_, c) => hmHasAtLeast(c, 10) },
  { id: 2,  name: 'Ninefold Harmony',  payout: '2000x',  test: (_, c) => hmHasAtLeast(c, 9)  },
  { id: 3,  name: 'Eightfold Harmony', payout: '500x',   test: (_, c) => hmHasAtLeast(c, 8)  },
  { id: 4,  name: 'Sevenfold Harmony', payout: '200x',   test: (_, c) => hmHasAtLeast(c, 7)  },
  { id: 5,  name: 'Sixfold Harmony',   payout: '80x',    test: (_, c) => hmHasAtLeast(c, 6)  },
  { id: 6,  name: 'Fivefold Harmony',  payout: '30x',    test: (_, c) => hmHasAtLeast(c, 5)  },
  { id: 7,  name: 'Double Quads',      payout: '200x',   test: (_, c) => hmCountExact(c, 4) >= 2 },
  { id: 8,  name: 'Quad + Triple',     payout: '120x',   test: (_, c) => hmHasExact(c, 4) && hmHasExact(c, 3) },
  { id: 9,  name: 'Three Triples',     payout: '90x',    test: (_, c) => hmTriples(c) >= 3   },
  { id: 10, name: 'Two Triples',       payout: '35x',    test: (_, c) => hmTriples(c) >= 2   },
  { id: 11, name: 'Five Pairs',        payout: '25x',    test: (_, c) => hmPairs(c) === 5 && Object.keys(c).length === 5 },
  { id: 12, name: 'Four Pairs',        payout: '10x',    test: (_, c) => hmPairs(c) === 4    },
  { id: 13, name: 'Full House',        payout: '20x',    test: (_, c) => hmTriples(c) >= 1 && hmPairs(c) >= 1 },
  { id: 14, name: 'Any Triple',        payout: '5x',     test: (_, c) => hmTriples(c) >= 1   },
  { id: 15, name: 'Straight-5',        payout: '15x',    test: (s)    => hmStraight(s, 5)    },
  { id: 16, name: 'Double Straight-4', payout: '30x',    test: (s)    => hmDouble4(s)        },
  { id: 17, name: 'Palindrome',        payout: '50x',    test: (s)    => s === s.split('').reverse().join('') },
  { id: 18, name: 'Alternating AB',    payout: '40x',    test: (s)    => s.length === 10 && s[0] !== s[1] && [...s].every((c,i) => c === s[i%2===0?0:1]) },
];

function hmEvaluate(seed10: string): HMRule | null {
  const c = hmCounts(seed10);
  for (const r of HM_RULES) if (r.test(seed10, c)) return { id: r.id, name: r.name, payout: r.payout };
  return null;
}

function hmPlayResult(txHash: string) {
  const seed10 = txHash.replace(/^0x/i, '').slice(-10).toLowerCase();
  const tiles   = seed10.split('').map(h => HM_TILE[h] ?? '?').join('');
  const rule    = hmEvaluate(seed10);
  return { seed10, tiles, win: !!rule, rule };
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function AgentsPage() {
  const router = useRouter();
  const { isUnlocked, address, privateKey, keystore, isCheckingSession, unlock, resetTxAuth } = useWallet();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<Model>('claude-sonnet-4-6');
  const [isRunning, setIsRunning] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  // Sandbox
  const [sandboxBalances, setSandboxBalances] = useState<{ INJ: string; USDT: string; USDC: string } | null>(null);
  const [harvestLoading, setHarvestLoading] = useState(false);
  const [showSandboxPanel, setShowSandboxPanel] = useState(false);
  const [showSandboxKey, setShowSandboxKey] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isRunning]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [input]);

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  // Close sandbox panel when switching conversations
  useEffect(() => { setShowSandboxPanel(false); setShowSandboxKey(false); }, [activeId]);

  // Poll sandbox wallet balance
  useEffect(() => {
    const sandboxAddr = activeConv?.sandboxAddress;
    if (!sandboxAddr || !isSandboxEnabled()) { setSandboxBalances(null); return; }
    let alive = true;
    async function refresh() {
      try {
        const bals = await getTokenBalances(['INJ', 'USDT', 'USDC'], sandboxAddr as Address);
        if (alive) setSandboxBalances({ INJ: bals.INJ ?? '0', USDT: bals.USDT ?? '0', USDC: bals.USDC ?? '0' });
      } catch { /* silent */ }
    }
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => { alive = false; clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeConv?.sandboxAddress]);

  // ─── Conversation management ────────────────────────────────────────────

  function newConversation() {
    const id = uid();
    const sandbox = isSandboxEnabled() ? generateSandboxWallet() : undefined;
    const conv: Conversation = {
      id, title: 'New chat', createdAt: Date.now(), messages: [], apiHistory: [],
      sandboxKey: sandbox?.key,
      sandboxAddress: sandbox?.addr,
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(id);
    setSidebarOpen(false);
  }

  function deleteConversation(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setActiveId((prev) => {
      if (prev !== id) return prev;
      const remaining = conversations.filter((c) => c.id !== id);
      return remaining.length > 0 ? remaining[0].id : null;
    });
  }

  function updateConv(id: string, updater: (c: Conversation) => Conversation) {
    setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  }

  function appendDisplay(convId: string, msg: ChatMessage) {
    updateConv(convId, (c) => ({ ...c, messages: [...c.messages, msg] }));
  }

  function appendApi(convId: string, msg: ApiMessage) {
    updateConv(convId, (c) => ({ ...c, apiHistory: [...(c.apiHistory ?? []), msg] }));
  }

  function getApiHistory(convId: string): ApiMessage[] {
    return conversations.find((c) => c.id === convId)?.apiHistory ?? [];
  }

  // ─── PIN-Free check ──────────────────────────────────────────────────────

  function isPinFreeActive(): boolean {
    if (!privateKey) return false;
    const minutes = parseInt(localStorage.getItem('auto_lock_minutes') ?? '0', 10);
    if (minutes <= 0) return false;
    const lastAuth = parseInt(localStorage.getItem('injpass_last_tx_auth') ?? '0', 10);
    return Date.now() - lastAuth <= minutes * 60 * 1000;
  }

  // ─── Tool execution ──────────────────────────────────────────────────────

  async function executeTool(
    name: string,
    input: Record<string, unknown>,
    overridePk?: Uint8Array,
  ): Promise<string> {
    if (!address) return JSON.stringify({ error: 'Wallet not connected' });

    // Sandbox mode: use sandbox wallet instead of user's real wallet
    const sandboxKey = activeConv?.sandboxKey ? hexToUint8(activeConv.sandboxKey) : undefined;
    const sandboxAddr = activeConv?.sandboxAddress ?? null;
    const inSandbox = isSandboxEnabled() && !!sandboxKey && !!sandboxAddr;
    const activeAddr = (inSandbox ? sandboxAddr : address) as Address;
    const pk = inSandbox ? sandboxKey : (overridePk ?? privateKey);

    try {
      if (name === 'get_wallet_info') {
        return JSON.stringify({
          address: activeAddr,
          network: 'Injective EVM Mainnet',
          chainId: 1776,
          ...(inSandbox ? { note: 'SANDBOX wallet — not the user\'s real wallet' } : {}),
        });
      }

      if (name === 'get_balance') {
        const balances = await getTokenBalances(['INJ', 'USDT', 'USDC'], activeAddr);
        if (inSandbox) setSandboxBalances({ INJ: balances.INJ ?? '0', USDT: balances.USDT ?? '0', USDC: balances.USDC ?? '0' });
        return JSON.stringify({ INJ: balances.INJ, USDT: balances.USDT, USDC: balances.USDC });
      }

      if (name === 'get_swap_quote') {
        const { fromToken, toToken, amount, slippage = 0.5 } = input as {
          fromToken: string; toToken: string; amount: string; slippage?: number;
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
        if (!pk) return JSON.stringify({ error: 'Wallet locked' });
        const { fromToken, toToken, amount, slippage = 0.5 } = input as {
          fromToken: string; toToken: string; amount: string; slippage?: number;
        };
        const pkHex = privateKeyToHex(pk);
        const txHash = await executeSwap({
          fromToken, toToken, amountIn: amount,
          slippage: Number(slippage),
          userAddress: activeAddr,
          privateKey: pkHex,
        });
        resetTxAuth(); // extend the PIN-free window
        return JSON.stringify({
          success: true,
          txHash,
          explorerUrl: `https://blockscout.injective.network/tx/${txHash}`,
        });
      }

      if (name === 'send_token') {
        if (!pk) return JSON.stringify({ error: 'Wallet locked' });
        const { toAddress, amount } = input as { toAddress: string; amount: string };
        const txHash = await sendTransaction(pk, toAddress, amount);
        resetTxAuth(); // extend the PIN-free window
        return JSON.stringify({
          success: true,
          txHash,
          explorerUrl: `https://blockscout.injective.network/tx/${txHash}`,
        });
      }

      if (name === 'get_tx_history') {
        const limit = (input.limit as number) ?? 10;
        const history = await getTxHistory(activeAddr, limit);
        return JSON.stringify(history);
      }

      if (name === 'play_hash_mahjong') {
        if (!pk) return JSON.stringify({ error: 'Wallet locked' });
        const txHash = await sendTransaction(pk, HM_GAME_ADDRESS, HM_PLAY_COST);
        const result = hmPlayResult(txHash);
        resetTxAuth();
        return JSON.stringify({
          txHash,
          tiles: result.tiles,
          seed10: result.seed10,
          win: result.win,
          rule: result.rule ? `${result.rule.name} (${result.rule.payout})` : null,
          explorerUrl: `https://blockscout.injective.network/tx/${txHash}`,
        });
      }

      if (name === 'play_hash_mahjong_multi') {
        if (!pk) return JSON.stringify({ error: 'Wallet locked' });
        const rounds = Math.min(Math.max(1, Number(input.rounds) || 5), 20);
        const results: { round: number; txHash: string; tiles: string; win: boolean; rule: string | null }[] = [];
        for (let i = 0; i < rounds; i++) {
          const txHash = await sendTransaction(pk, HM_GAME_ADDRESS, HM_PLAY_COST);
          const r = hmPlayResult(txHash);
          results.push({
            round: i + 1,
            txHash,
            tiles: r.tiles,
            win: r.win,
            rule: r.rule ? `${r.rule.name} (${r.rule.payout})` : null,
          });
        }
        resetTxAuth();
        const wins = results.filter(r => r.win);
        return JSON.stringify({
          totalRounds: rounds,
          wins: wins.length,
          losses: rounds - wins.length,
          winRate: `${((wins.length / rounds) * 100).toFixed(1)}%`,
          bestRule: wins.reduce<string | null>((best, r) => r.rule ?? best, null),
          results,
        });
      }

      return JSON.stringify({ error: `Unknown tool: ${name}` });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  }

  // ─── Sandbox harvest ─────────────────────────────────────────────────────

  async function harvestSandbox() {
    if (!activeConv?.sandboxKey || !address) return;
    const pk = hexToUint8(activeConv.sandboxKey);
    const sandboxAddr = activeConv.sandboxAddress as Address;
    setHarvestLoading(true);
    try {
      const bals = await getTokenBalances(['INJ', 'USDT', 'USDC'], sandboxAddr);
      // ERC-20: USDT
      if (parseFloat(bals.USDT ?? '0') > 0) {
        const amt = parseUnits(bals.USDT, 6);
        await sendTransaction(pk, TOKENS_MAINNET.USDT.address, '0', encodeERC20Transfer(address, amt));
      }
      // ERC-20: USDC
      if (parseFloat(bals.USDC ?? '0') > 0) {
        const amt = parseUnits(bals.USDC, 6);
        await sendTransaction(pk, TOKENS_MAINNET.USDC.address, '0', encodeERC20Transfer(address, amt));
      }
      // Native INJ — leave 0.001 for gas
      const injBal = parseFloat(bals.INJ ?? '0');
      if (injBal > 0.002) {
        await sendTransaction(pk, address, (injBal - 0.001).toFixed(6));
      }
      // AI feedback in chat
      const convId = activeId;
      if (convId) {
        const harvested = [
          parseFloat(bals.USDT ?? '0') > 0 && `${parseFloat(bals.USDT).toFixed(2)} USDT`,
          parseFloat(bals.USDC ?? '0') > 0 && `${parseFloat(bals.USDC).toFixed(2)} USDC`,
          injBal > 0.002 && `${(injBal - 0.001).toFixed(4)} INJ`,
        ].filter(Boolean).join(', ');
        appendDisplay(convId, {
          id: uid(),
          role: 'assistant',
          content: harvested
            ? `Sweep complete — transferred ${harvested} from the sandbox wallet to your real wallet (${address?.slice(0, 10)}…${address?.slice(-6)}).`
            : `Nothing to sweep — the sandbox wallet balance is too low to cover gas fees.`,
        });
      }

      // Refresh balances
      setTimeout(async () => {
        const nb = await getTokenBalances(['INJ', 'USDT', 'USDC'], sandboxAddr);
        setSandboxBalances({ INJ: nb.INJ ?? '0', USDT: nb.USDT ?? '0', USDC: nb.USDC ?? '0' });
      }, 4000);
    } catch (err) {
      console.error('[harvest]', err);
    } finally {
      setHarvestLoading(false);
      setShowSandboxPanel(false);
    }
  }

  // ─── Core agent loop ─────────────────────────────────────────────────────
  // Runs until the model returns a final text response with no more tool calls.
  // Destructive tools (swap, send) pause and wait for the confirmation modal.

  const runLoop = useCallback(async (convId: string, history: ApiMessage[]) => {
    setIsRunning(true);

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history,
            model,
            systemExtra: (isSandboxEnabled() && activeConv?.sandboxAddress)
              ? `SANDBOX MODE ACTIVE: You are controlling a disposable sandbox wallet (address: ${activeConv.sandboxAddress}). This is NOT the user's real wallet. All operations (swaps, sends, game plays) will use this sandbox address. The user can sweep any sandbox funds to their real wallet at any time using the harvest button.`
              : undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? 'API error');
        }

        const data = await res.json();
        const blocks: ApiBlock[] = data.content ?? [];

        // Build the assistant api message and persist it
        const assistantApiMsg: ApiMessage = { role: 'assistant', content: blocks };
        history = [...history, assistantApiMsg];
        appendApi(convId, assistantApiMsg);

        // Render text blocks
        const textContent = blocks
          .filter((b) => b.type === 'text')
          .map((b) => b.text ?? '')
          .join('\n')
          .trim();

        if (textContent) {
          appendDisplay(convId, { id: uid(), role: 'assistant', content: textContent });
        }

        // Find tool_use blocks
        const toolUseBlocks = blocks.filter((b) => b.type === 'tool_use');

        // No more tools → done
        if (toolUseBlocks.length === 0) break;

        // Process tools in sequence
        let shouldPause = false;

        for (const tool of toolUseBlocks) {
          const toolName = tool.name!;
          const toolInput = (tool.input ?? {}) as Record<string, unknown>;
          const toolId = tool.id!;
          const isDestructive =
            toolName === 'execute_swap' ||
            toolName === 'send_token' ||
            toolName === 'play_hash_mahjong' ||
            toolName === 'play_hash_mahjong_multi';

          if (isDestructive && !isPinFreeActive()) {
            // Pause and show confirmation modal
            setPendingConfirm({
              convId,
              toolUseId: toolId,
              toolName,
              toolInput,
              assistantApiMessage: assistantApiMsg,
            });
            setIsRunning(false);
            shouldPause = true;
            break;
          }

          // Safe tool — execute immediately and show result
          const resultContent = await executeTool(toolName, toolInput);

          // Show in UI
          appendDisplay(convId, {
            id: uid(),
            role: 'tool',
            content: formatToolResult(toolName, resultContent),
          });

          // Add tool_result to history
          const toolResultMsg: ApiMessage = {
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: toolId,
              content: resultContent,
            }],
          };
          history = [...history, toolResultMsg];
          appendApi(convId, toolResultMsg);
        }

        if (shouldPause) return; // resume handled by handleConfirm / handleCancel
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      appendDisplay(convId, { id: uid(), role: 'assistant', content: `❌ Error: ${msg}`, isError: true });
    } finally {
      setIsRunning(false);
    }
  }, [model]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Confirm destructive tool ────────────────────────────────────────────

  async function handleConfirm() {
    if (!pendingConfirm) return;
    // If private key not yet in memory, ask the user to re-authenticate first
    if (!privateKey) {
      setShowAuthModal(true);
      return;
    }
    await executeConfirmedTool();
  }

  async function executeConfirmedTool(overridePk?: Uint8Array) {
    if (!pendingConfirm) return;
    const { convId, toolUseId, toolName, toolInput } = pendingConfirm;
    setConfirmLoading(true);

    const resultContent = await executeTool(toolName, toolInput, overridePk);
    const parsed = JSON.parse(resultContent);

    appendDisplay(convId, {
      id: uid(),
      role: 'tool',
      content: parsed.error
        ? `❌ **${toolName}** failed: ${parsed.error}`
        : `✅ **${toolName}** executed\nTx Hash: \`${parsed.txHash}\`\n[View on Blockscout](${parsed.explorerUrl})`,
    });

    const toolResultMsg: ApiMessage = {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUseId, content: resultContent }],
    };
    appendApi(convId, toolResultMsg);

    const currentHistory = [...getApiHistory(convId), toolResultMsg];

    setPendingConfirm(null);
    setConfirmLoading(false);

    await runLoop(convId, currentHistory);
  }

  async function handleAuthWithPasskey() {
    if (!keystore?.credentialId) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const entropy = await unlockByPasskey(keystore.credentialId);
      const pk = await decryptKey(keystore.encryptedPrivateKey, entropy);
      unlock(pk, keystore);
      setShowAuthModal(false);
      setAuthLoading(false);
      await executeConfirmedTool(pk);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
      setAuthLoading(false);
    }
  }

  async function handleAuthWithPassword() {
    if (!keystore || !authPassword) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const encoder = new TextEncoder();
      const rawEntropy = encoder.encode(authPassword);
      const entropy = new Uint8Array(Math.max(rawEntropy.length, 32));
      entropy.set(rawEntropy);
      const pk = await decryptKey(keystore.encryptedPrivateKey, entropy);
      unlock(pk, keystore);
      setShowAuthModal(false);
      setAuthPassword('');
      setAuthLoading(false);
      await executeConfirmedTool(pk);
    } catch {
      setAuthError('Incorrect password');
      setAuthLoading(false);
    }
  }

  function handleCancel() {
    if (!pendingConfirm) return;
    appendDisplay(pendingConfirm.convId, {
      id: uid(),
      role: 'assistant',
      content: '🚫 Operation cancelled.',
    });
    setPendingConfirm(null);
  }

  // ─── Send message ────────────────────────────────────────────────────────

  async function handleSend() {
    const text = input.trim();
    if (!text || isRunning) return;
    setInput('');

    let convId = activeId;
    let currentHistory: ApiMessage[] = [];

    if (!convId) {
      const id = uid();
      const conv: Conversation = { id, title: text.slice(0, 40), createdAt: Date.now(), messages: [], apiHistory: [] };
      setConversations((prev) => [conv, ...prev]);
      setActiveId(id);
      convId = id;
    } else {
      currentHistory = getApiHistory(convId);
      if (messages.length === 0) {
        updateConv(convId, (c) => ({ ...c, title: text.slice(0, 40) }));
      }
    }

    // Add user message
    appendDisplay(convId, { id: uid(), role: 'user', content: text });
    const userApiMsg: ApiMessage = { role: 'user', content: text };
    appendApi(convId, userApiMsg);
    currentHistory = [...currentHistory, userApiMsg];

    await runLoop(convId, currentHistory);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ─── Render helpers ──────────────────────────────────────────────────────

  function formatToolResult(name: string, raw: string): string {
    try {
      const parsed = JSON.parse(raw);
      return `🔧 **${name}**\n\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
    } catch {
      return `🔧 **${name}**: ${raw}`;
    }
  }

  function renderMessageContent(content: string) {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inCode = false;
    let codeLines: string[] = [];
    let keyIdx = 0;

    for (const line of lines) {
      if (line.startsWith('```')) {
        if (!inCode) { inCode = true; codeLines = []; }
        else {
          elements.push(
            <pre key={keyIdx++} className="bg-white/5 border border-white/10 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono text-green-300 whitespace-pre-wrap break-all">
              {codeLines.join('\n')}
            </pre>
          );
          inCode = false;
        }
        continue;
      }
      if (inCode) { codeLines.push(line); continue; }

      elements.push(
        <p key={keyIdx++} className="mb-1 leading-relaxed break-all">
          {renderInline(line)}
        </p>
      );
    }
    return <div className="text-sm">{elements}</div>;
  }

  function renderInline(text: string): React.ReactNode {
    return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`'))
        return <code key={i} className="bg-white/10 px-1 rounded text-xs font-mono text-blue-300 break-all">{part.slice(1, -1)}</code>;
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch)
        return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline break-all">{linkMatch[1]}</a>;
      return part;
    });
  }

  function toolConfirmLabel(name: string, input: Record<string, unknown>) {
    if (name === 'execute_swap') {
      const expected = input.expectedOutput
        ? ` → ~${Number(input.expectedOutput).toFixed(4)} ${input.toToken}`
        : ` → ${input.toToken}`;
      return `Swap ${input.amount} ${input.fromToken}${expected}`;
    }
    if (name === 'send_token') {
      const addr = String(input.toAddress);
      return `Send ${input.amount} INJ to ${addr.slice(0, 10)}...${addr.slice(-6)}`;
    }
    if (name === 'play_hash_mahjong') return 'Play Hash Mahjong × 1 round (0.000001 INJ)';
    if (name === 'play_hash_mahjong_multi') {
      const rounds = Math.min(Math.max(1, Number(input.rounds) || 5), 20);
      return `Play Hash Mahjong × ${rounds} rounds (${(rounds * 0.000001).toFixed(6)} INJ total)`;
    }
    return name;
  }

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

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:relative z-30 md:z-auto top-0 left-0 h-full w-72 flex-shrink-0
        bg-[#0a0a0a] border-r border-white/10 flex flex-col
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
              </svg>
            </div>
            <span className="font-bold text-sm">Agents</span>
          </div>
          <button onClick={newConversation} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="New chat">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
          {conversations.length === 0 ? (
            <div className="text-center py-10 text-gray-600 text-xs"><p>No conversations yet</p></div>
          ) : conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${conv.id === activeId ? 'bg-white/10' : 'hover:bg-white/5'}`}
              onClick={() => { setActiveId(conv.id); setSidebarOpen(false); }}
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
          ))}
        </div>

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

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">

        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/50 backdrop-blur-sm flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-white/10 transition-colors md:hidden">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button onClick={() => router.push('/dashboard')} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 text-center">
            <span className="font-semibold text-sm">{activeConv?.title ?? 'New chat'}</span>
          </div>
          <button onClick={newConversation} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2"><span className="lambda-gradient">λ</span> Agent</h2>
              <p className="text-gray-400 text-sm max-w-sm mb-8">
                AI-powered wallet assistant. Ask me to check balances, swap tokens, send INJ, or explain anything on Injective.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-sm">
                {[
                  'What is my wallet address?',
                  'Show my balances',
                  'Swap all INJ to USDT',
                  'Show my recent transactions',
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                    className="text-left px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-300 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.filter((msg) => msg.role !== 'tool').map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${
                    msg.role === 'user' ? 'bg-white text-black' : 'bg-white/10'
                  }`}>
                    {msg.role === 'user' ? 'U' : <span className="lambda-gradient">λ</span>}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user' ? 'bg-white text-black rounded-tr-sm'
                    : msg.isError ? 'bg-red-500/10 border border-red-500/20 text-red-200 rounded-tl-sm'
                    : 'bg-white/5 border border-white/10 text-gray-100 rounded-tl-sm'
                  }`}>
                    {msg.role === 'user'
                      ? <p className="text-sm">{msg.content}</p>
                      : renderMessageContent(msg.content)
                    }
                  </div>
                </div>
              ))}

              {isRunning && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold">
                    <span className="lambda-gradient">λ</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1 items-center h-5">
                      {[0, 150, 300].map((d) => (
                        <div key={d} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ── Confirmation modal ── */}
        {pendingConfirm && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-[#111] border border-white/15 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
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

              {/* Swap visual */}
              {pendingConfirm.toolName === 'execute_swap' && (() => {
                const { fromToken, toToken, amount, expectedOutput } = pendingConfirm.toolInput as {
                  fromToken: string; toToken: string; amount: string; expectedOutput?: string;
                };
                return (
                  <div className="px-5 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
                        <div className="flex items-center justify-center mb-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={TOKEN_ICONS[fromToken] ?? ''} alt={fromToken} className="w-8 h-8 object-contain" />
                        </div>
                        <div className="text-base font-bold">{amount}</div>
                        <div className="text-xs text-gray-400">{fromToken}</div>
                      </div>
                      <div className="flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </div>
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
                    {pendingConfirm.toolInput.slippage != null && (
                      <div className="mt-3 flex justify-between text-xs text-gray-500">
                        <span>Slippage</span><span>{String(pendingConfirm.toolInput.slippage)}%</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Send visual */}
              {pendingConfirm.toolName === 'send_token' && (() => {
                const { toAddress, amount } = pendingConfirm.toolInput as { toAddress: string; amount: string };
                return (
                  <div className="px-5 py-4 border-b border-white/10">
                    <div className="text-center mb-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/injswap.png" alt="INJ" className="w-10 h-10 object-contain mx-auto mb-1" />
                      <div className="text-2xl font-bold">{amount} INJ</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                      <div className="text-xs text-gray-400 mb-1">To address</div>
                      <div className="text-xs font-mono text-white break-all">{toAddress}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Hash Mahjong visual */}
              {(pendingConfirm.toolName === 'play_hash_mahjong' || pendingConfirm.toolName === 'play_hash_mahjong_multi') && (() => {
                const rounds = pendingConfirm.toolName === 'play_hash_mahjong'
                  ? 1
                  : Math.min(Math.max(1, Number(pendingConfirm.toolInput.rounds) || 5), 20);
                const totalCost = (rounds * 0.000001).toFixed(6);
                return (
                  <div className="px-5 py-4 border-b border-white/10">
                    <div className="text-center mb-3">
                      <div className="text-3xl mb-2">🀄</div>
                      <div className="text-lg font-bold">{rounds === 1 ? 'Hash Mahjong' : `Hash Mahjong × ${rounds} rounds`}</div>
                      <div className="text-sm text-gray-400 mt-1">Cost: {totalCost} INJ</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-xs text-gray-400 text-center">
                      Tiles are derived from your on-chain tx hash. 18 win patterns supported.
                    </div>
                  </div>
                );
              })()}

              <div className="px-5 py-3">
                <div className="text-xs text-gray-400 mb-3">
                  {toolConfirmLabel(pendingConfirm.toolName, pendingConfirm.toolInput)}
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-3.5 h-3.5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <p className="text-xs text-gray-400">Private key never leaves your device. Signed locally.</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleCancel} disabled={confirmLoading} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-bold text-sm transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleConfirm} disabled={confirmLoading} className="flex-1 py-3 rounded-xl bg-white hover:bg-gray-100 text-black font-bold text-sm transition-colors flex items-center justify-center gap-2">
                    {confirmLoading && <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />}
                    {confirmLoading ? 'Processing…' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Re-auth modal (privateKey not in memory) ── */}
        {showAuthModal && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-[#111] border border-white/15 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
              <div className="px-5 pt-5 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Verify Identity</h3>
                    <p className="text-xs text-gray-400">Re-authenticate to sign this transaction</p>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4">
                {authError && (
                  <div className="mb-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    {authError}
                  </div>
                )}

                {keystore?.source === 'passkey' && (
                  <button
                    onClick={handleAuthWithPasskey}
                    disabled={authLoading}
                    className="w-full py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {authLoading
                      ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />Verifying…</>
                      : <>🔑 Authenticate with Passkey</>}
                  </button>
                )}

                {keystore?.source === 'import' && (
                  <div className="space-y-3">
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAuthWithPassword()}
                      placeholder="Enter your wallet password"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-white/30 transition-colors"
                      autoFocus
                    />
                    <button
                      onClick={handleAuthWithPassword}
                      disabled={authLoading || !authPassword}
                      className="w-full py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {authLoading
                        ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />Verifying…</>
                        : '🔓 Unlock & Sign'}
                    </button>
                  </div>
                )}

                <button
                  onClick={() => { setShowAuthModal(false); setAuthError(''); setAuthPassword(''); }}
                  disabled={authLoading}
                  className="w-full mt-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 font-semibold text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="flex-shrink-0 border-t border-white/10 bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-3xl mx-auto">

            {/* Sandbox / takeover address badge — click to flip card */}
            {activeConv?.sandboxAddress && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <button
                  onClick={() => setShowSandboxPanel(p => !p)}
                  className={`text-[10px] font-semibold rounded-full px-2.5 py-0.5 cursor-pointer transition-colors ${
                    isSandboxEnabled()
                      ? 'text-emerald-400/90 bg-emerald-400/10 border border-emerald-400/25 hover:bg-emerald-400/20'
                      : 'text-amber-400/90 bg-amber-400/10 border border-amber-400/25 hover:bg-amber-400/20'
                  }`}
                >
                  {isSandboxEnabled() ? 'Sandbox' : '接管'} · {activeConv.sandboxAddress.slice(0, 10)}…{activeConv.sandboxAddress.slice(-6)}
                </button>
              </div>
            )}

            {/* Flip card: front = input, back = balance panel (flips top-to-bottom) */}
            <div style={{ perspective: '900px' }}>
              <div
                style={{
                  transformStyle: 'preserve-3d',
                  transform: showSandboxPanel ? 'rotateX(180deg)' : 'rotateX(0deg)',
                  transition: 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                }}
              >
                {/* ── Front face: normal input bar ── */}
                <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' } as React.CSSProperties}>
                  <div className="flex items-end gap-3 bg-white/5 border border-white/15 rounded-2xl px-4 py-3 focus-within:border-white/30 transition-colors">
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value as Model)}
                      className="bg-transparent text-xs text-gray-400 border-none outline-none cursor-pointer hover:text-white transition-colors py-1 pr-1 flex-shrink-0"
                    >
                      {MODEL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-black">{opt.label}</option>
                      ))}
                    </select>
                    <div className="w-px h-5 bg-white/15 flex-shrink-0 self-center" />
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask anything about your wallet…"
                      rows={1}
                      disabled={isRunning || !!pendingConfirm}
                      className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 resize-none outline-none min-h-[24px] max-h-40 py-1 disabled:opacity-50"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isRunning || !!pendingConfirm}
                      className="w-8 h-8 rounded-xl bg-white hover:bg-gray-100 disabled:bg-white/20 disabled:cursor-not-allowed text-black flex items-center justify-center transition-all flex-shrink-0 self-end"
                    >
                      {isRunning
                        ? <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" /></svg>
                      }
                    </button>
                  </div>
                </div>

                {/* ── Back face: sandbox balance panel ── */}
                <div
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateX(180deg)',
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                  } as React.CSSProperties}
                >
                  <div className="flex flex-col justify-center gap-2 bg-white/5 border border-white/15 rounded-2xl px-4 py-3 h-full">
                    {/* Row 1: balances + action buttons */}
                    <div className="flex items-center gap-4">
                      {/* Balances */}
                      <div className="flex-1 flex items-center gap-5">
                        {sandboxBalances ? (
                          ['INJ', 'USDT', 'USDC'].map(sym => {
                            const raw = sandboxBalances[sym as keyof typeof sandboxBalances] ?? '0';
                            const val = parseFloat(raw);
                            return (
                              <div key={sym} className="text-xs">
                                <span className="text-gray-500 mr-1">{sym}</span>
                                <span className={val > 0 ? 'text-white font-bold' : 'text-gray-600'}>
                                  {sym === 'INJ' ? val.toFixed(4) : val.toFixed(2)}
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-xs text-gray-600">Loading…</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Show private key */}
                        <button
                          onClick={() => setShowSandboxKey(p => !p)}
                          title={showSandboxKey ? 'Hide private key' : 'Show private key'}
                          className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all ${
                            showSandboxKey
                              ? 'bg-white/15 border-white/30'
                              : 'bg-white/5 hover:bg-white/10 border-white/10'
                          }`}
                        >
                          <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                          </svg>
                        </button>
                        {/* Sweep / withdraw */}
                        <button
                          onClick={() => !harvestLoading && harvestSandbox()}
                          disabled={harvestLoading}
                          title="Sweep all funds to your real wallet"
                          className="w-8 h-8 rounded-xl bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 flex items-center justify-center transition-all disabled:opacity-40"
                        >
                          {harvestLoading
                            ? <div className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                            : <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                              </svg>
                          }
                        </button>
                        {/* Close */}
                        <button
                          onClick={() => { setShowSandboxPanel(false); setShowSandboxKey(false); }}
                          title="Close"
                          className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all"
                        >
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Row 2: private key (visible only when toggled) */}
                    {showSandboxKey && activeConv?.sandboxKey && (
                      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
                        <span className="flex-1 text-[10px] font-mono text-gray-400 break-all select-all leading-relaxed">
                          {activeConv.sandboxKey}
                        </span>
                        <button
                          onClick={() => navigator.clipboard.writeText(activeConv.sandboxKey ?? '')}
                          title="Copy private key"
                          className="flex-shrink-0 w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                        >
                          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
