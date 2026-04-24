'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  isError?: boolean;
}

interface SupportResponse {
  message?: string;
  error?: string;
}

const STORAGE_KEY = 'injpass_support_chat_v2';

const INTRO_MESSAGE: ChatMessage = {
  id: 'intro',
  role: 'assistant',
  content:
    'I am Eric. Ask me about INJ Pass, Injective, DeFi strategy, or what to do next.',
};

const SHORTCUT_POOL = [
  'What is INJ Pass?',
  'Why Injective?',
  'Wallet security basics',
  'Explain AgentOS',
  'DeFi strategy',
  'Bear market playbook',
  'Passkeys vs seed phrases',
  'How to start safely?',
  'What should I build?',
  'RWA on Injective',
  'Finance L1 thesis',
  'Avoid wallet mistakes',
];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function pickShortcuts(): string[] {
  return [...SHORTCUT_POOL]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
}

function SendIcon({ className = 'text-white' }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 19V5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="m6.75 10.25 5.25-5.25 5.25 5.25"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7.1 7.1A7 7 0 1 1 6 15.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7 3.8v3.5h3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 7l10 10M17 7 7 17"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Eric is thinking">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-160ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-80ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
    </span>
  );
}

function readStoredMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [INTRO_MESSAGE];
    }

    const parsed = JSON.parse(raw) as ChatMessage[];
    const messages = Array.isArray(parsed)
      ? parsed.filter((message) => (
          message
          && (message.role === 'user' || message.role === 'assistant')
          && typeof message.content === 'string'
          && message.content.trim()
        ))
      : [];

    return messages.length > 0 ? messages : [INTRO_MESSAGE];
  } catch {
    return [INTRO_MESSAGE];
  }
}

export default function SupportChat() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([INTRO_MESSAGE]);
  const [shortcuts, setShortcuts] = useState<string[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [hideForEmbeddedSurface, setHideForEmbeddedSurface] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setMessages(readStoredMessages());
    setShortcuts(pickShortcuts());
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    let isFramed = false;

    try {
      isFramed = window.self !== window.top;
    } catch {
      isFramed = true;
    }

    const isEmbedParam = new URLSearchParams(window.location.search).get('embed') === '1';
    setHideForEmbeddedSurface(Boolean(pathname?.startsWith('/embed')) || isEmbedParam || isFramed);
  }, [pathname]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-24)));
  }, [hasHydrated, messages]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    scrollRef.current?.scrollIntoView({ block: 'end' });
    inputRef.current?.focus();
  }, [isOpen, messages, isSending]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  if (hideForEmbeddedSurface) {
    return null;
  }

  const openChat = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setIsClosing(false);
    setIsOpen(true);
  };

  const closeChat = () => {
    setIsClosing(true);

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      closeTimerRef.current = null;
    }, 240);
  };

  const resetChat = () => {
    setMessages([{ ...INTRO_MESSAGE, id: `intro-${uid()}` }]);
    setShortcuts(pickShortcuts());
    setDraft('');
  };

  const sendMessage = async (overrideContent?: string) => {
    const content = (overrideContent ?? draft).trim();
    if (!content || isSending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: uid(),
      role: 'user',
      content,
    };
    const nextMessages = [...messages, userMessage];
    const assistantMessage: ChatMessage = {
      id: uid(),
      role: 'assistant',
      content: '',
    };

    setMessages([...nextMessages, assistantMessage]);
    setDraft('');
    setShortcuts([]);
    setIsSending(true);

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as SupportResponse;
        throw new Error(data.error || 'Support is temporarily unavailable.');
      }

      if (!response.body) {
        throw new Error('Support is temporarily unavailable.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          streamedContent += decoder.decode(value, { stream: true });
          setMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.id === assistantMessage.id
                ? { ...message, content: streamedContent }
                : message
            )
          );
        }

        const finalChunk = decoder.decode();
        if (finalChunk) {
          streamedContent += finalChunk;
          setMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.id === assistantMessage.id
                ? { ...message, content: streamedContent }
                : message
            )
          );
        }
      } finally {
        reader.releaseLock();
      }

      if (!streamedContent.trim()) {
        throw new Error('Support returned an empty response.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Support is temporarily unavailable.';
      setMessages((currentMessages) => {
        const hasAssistantPlaceholder = currentMessages.some((item) => item.id === assistantMessage.id);

        if (!hasAssistantPlaceholder) {
          return [
            ...nextMessages,
            {
              ...assistantMessage,
              content: message,
              isError: true,
            },
          ];
        }

        return currentMessages.map((item) =>
          item.id === assistantMessage.id
            ? { ...item, content: message, isError: true }
            : item
        );
      });
    } finally {
      setIsSending(false);
    }
  };

  const panelClass = isLight
    ? 'border-slate-200/90 bg-white/95 text-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.18)]'
    : 'border-white/10 bg-[#090b10]/95 text-white shadow-[0_24px_80px_rgba(0,0,0,0.42)]';

  const headerClass = isLight
    ? 'border-slate-200/90 bg-white/90'
    : 'border-white/10 bg-white/[0.03]';

  const mutedTextClass = isLight ? 'text-slate-500' : 'text-gray-400';

  return (
    <>
      {isOpen ? (
        <section
          className={`fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-3 right-3 z-[70] flex h-[min(36rem,calc(100vh-7rem))] origin-bottom-right flex-col overflow-hidden rounded-lg border backdrop-blur-xl transition-[opacity,transform,filter] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:left-auto sm:right-4 sm:w-96 ${
            isClosing
              ? 'pointer-events-none translate-y-3 scale-[0.985] opacity-0 blur-[2px]'
              : 'translate-y-0 scale-100 opacity-100 blur-0'
          } ${panelClass}`}
          aria-label="Eric support chat"
        >
          <header className={`flex items-center justify-between border-b px-4 py-3 ${headerClass}`}>
            <div className="flex min-w-0 items-center">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">Eric</h2>
                <p className={`truncate text-xs ${mutedTextClass}`}>Speclist in AgentOS</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={resetChat}
                className={`rounded-lg p-2 transition-colors ${
                  isLight ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-900' : 'text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
                aria-label="Start a new support chat"
                title="New chat"
              >
                <ResetIcon />
              </button>
              <button
                type="button"
                onClick={closeChat}
                className={`rounded-lg p-2 transition-colors ${
                  isLight ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-900' : 'text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
                aria-label="Close support chat"
                title="Close"
              >
                <CloseIcon />
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message) => {
              const isUser = message.role === 'user';
              const isPendingAssistant = message.role === 'assistant' && !message.content && !message.isError;
              const bubbleClass = isUser
                ? isLight
                  ? 'ml-auto border border-slate-200 bg-slate-50 text-slate-900'
                  : 'ml-auto border border-black bg-[linear-gradient(180deg,#17191f,#050607)] text-white shadow-[0_8px_18px_rgba(0,0,0,0.16)]'
                : message.isError
                  ? isLight
                    ? 'mr-auto border border-red-200 bg-red-50 text-red-700'
                    : 'mr-auto border border-red-400/25 bg-red-500/10 text-red-200'
                  : isLight
                    ? 'mr-auto border border-slate-200 bg-slate-50 text-slate-900'
                    : 'mr-auto border border-white/10 bg-white/[0.06] text-gray-100';

              return (
                <div
                  key={message.id}
                  className={`max-w-[86%] rounded-lg px-3 py-2 text-sm leading-6 ${bubbleClass}`}
                >
                  {isPendingAssistant ? (
                    <TypingDots />
                  ) : (
                    <p className={`whitespace-pre-wrap break-words ${isUser && !isLight ? 'text-white' : ''}`}>{message.content}</p>
                  )}
                </div>
              );
            })}

            {shortcuts.length > 0 && messages.length === 1 ? (
              <div className="flex flex-wrap gap-2">
                {shortcuts.map((shortcut) => (
                  <button
                    key={shortcut}
                    type="button"
                    onClick={() => void sendMessage(shortcut)}
                    disabled={isSending}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${
                      isLight
                        ? 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        : 'border-white/10 bg-white/[0.04] text-gray-200 hover:border-white/20 hover:bg-white/[0.08]'
                    }`}
                  >
                    {shortcut}
                  </button>
                ))}
              </div>
            ) : null}

            <div ref={scrollRef} />
          </div>

          <form
            className={`border-t p-3 ${isLight ? 'border-slate-200/90 bg-white/85' : 'border-white/10 bg-black/20'}`}
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            <div
              className={`flex items-end gap-2 rounded-lg border px-2 py-2 ${
                isLight
                  ? 'border-slate-200 bg-white'
                  : 'border-white/10 bg-white/[0.04]'
              }`}
            >
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                rows={1}
                placeholder="Ask Eric..."
                className={`max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 outline-none ${
                  isLight ? 'text-slate-950 placeholder:text-slate-400' : 'text-white placeholder:text-gray-500'
                }`}
                disabled={isSending}
              />
              <button
                type="submit"
                disabled={!draft.trim() || isSending}
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border text-white shadow-[0_10px_22px_rgba(0,0,0,0.22)] transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                  isLight
                    ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    : 'border-white/10 bg-[linear-gradient(180deg,#242832,#050608)] hover:border-white/20 hover:bg-[#16191f]'
                }`}
                aria-label="Send support message"
                title="Send"
              >
                <SendIcon className={isLight ? 'text-slate-950' : 'text-white'} />
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        onClick={isOpen ? closeChat : openChat}
        className={`fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-[80] inline-flex h-12 origin-bottom-right items-center justify-center rounded-full border px-5 text-sm font-semibold shadow-2xl transition-[opacity,transform,border-color,background-color,box-shadow] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] ${
          isLight
            ? 'border-slate-200 bg-white text-slate-950 shadow-[0_18px_46px_rgba(15,23,42,0.16)] hover:border-slate-300 hover:bg-slate-50 hover:shadow-[0_22px_54px_rgba(15,23,42,0.2)]'
            : 'border-white/10 bg-[#10131a] text-white shadow-[0_18px_46px_rgba(0,0,0,0.34)] hover:border-white/20 hover:bg-[#151b24] hover:shadow-[0_22px_54px_rgba(0,0,0,0.42)]'
        }`}
        aria-label={isOpen ? 'Close Eric support' : 'Open Eric support'}
        title={isOpen ? 'Close support' : 'Open support'}
      >
        <span>Support</span>
      </button>
    </>
  );
}
