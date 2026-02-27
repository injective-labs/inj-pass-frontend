import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL ?? 'https://yinli.one',
});

// Tool definitions — the AI can request these; actual execution happens client-side
export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_balance',
    description:
      'Get the current token balances of the user wallet. Returns INJ, USDT and USDC balances.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_swap_quote',
    description:
      'Get a price quote for swapping tokens BEFORE executing. Use this first to show the user the expected output amount and price impact. Supports all pairs: INJ↔USDT, INJ↔USDC, USDT↔USDC.',
    input_schema: {
      type: 'object' as const,
      properties: {
        fromToken: {
          type: 'string',
          enum: ['INJ', 'USDT', 'USDC'],
          description: 'The token to sell',
        },
        toToken: {
          type: 'string',
          enum: ['INJ', 'USDT', 'USDC'],
          description: 'The token to buy',
        },
        amount: {
          type: 'string',
          description: 'Amount to swap (e.g. "0.5")',
        },
        slippage: {
          type: 'number',
          description: 'Slippage tolerance in percent (default 0.5)',
        },
      },
      required: ['fromToken', 'toToken', 'amount'],
    },
  },
  {
    name: 'execute_swap',
    description:
      'Execute a token swap on Injective EVM mainnet using the Pumex DEX. ALWAYS call get_swap_quote first so the user knows the expected output. Requires user confirmation before execution. Supports all pairs: INJ↔USDT, INJ↔USDC, USDT↔USDC.',
    input_schema: {
      type: 'object' as const,
      properties: {
        fromToken: {
          type: 'string',
          enum: ['INJ', 'USDT', 'USDC'],
          description: 'The token to sell',
        },
        toToken: {
          type: 'string',
          enum: ['INJ', 'USDT', 'USDC'],
          description: 'The token to buy',
        },
        amount: {
          type: 'string',
          description: 'Amount to swap (e.g. "0.5")',
        },
        slippage: {
          type: 'number',
          description: 'Slippage tolerance in percent (default 0.5)',
        },
        expectedOutput: {
          type: 'string',
          description: 'Expected output from get_swap_quote (for display in confirmation)',
        },
      },
      required: ['fromToken', 'toToken', 'amount'],
    },
  },
  {
    name: 'send_token',
    description:
      'Send INJ to another wallet address on Injective EVM mainnet. Requires user confirmation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        toAddress: {
          type: 'string',
          description: 'Recipient wallet address (0x...)',
        },
        amount: {
          type: 'string',
          description: 'Amount of INJ to send (e.g. "0.1")',
        },
      },
      required: ['toAddress', 'amount'],
    },
  },
  {
    name: 'get_tx_history',
    description: 'Retrieve the recent transaction history for the user wallet.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Number of transactions to retrieve (default 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_wallet_info',
    description: 'Get the user wallet address and network information.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string | Anthropic.ContentBlock[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, model = 'claude-sonnet-4-5', toolResults } = body as {
      messages: AgentMessage[];
      model?: string;
      toolResults?: { tool_use_id: string; content: string }[];
    };

    // Build the message array for Anthropic
    // If toolResults provided, append them as a user message with tool_result blocks
    let apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content as string | Anthropic.ContentBlockParam[],
    }));

    if (toolResults && toolResults.length > 0) {
      apiMessages.push({
        role: 'user',
        content: toolResults.map((r) => ({
          type: 'tool_result' as const,
          tool_use_id: r.tool_use_id,
          content: r.content,
        })),
      });
    }

    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: `You are an AI agent integrated into INJ Pass, a non-custodial Web3 wallet for Injective mainnet.
The user is already authenticated and their wallet is unlocked.

CAPABILITIES:
- get_wallet_info: get the user's wallet address
- get_balance: get INJ, USDT, USDC balances
- get_swap_quote: get a price quote before swapping
- execute_swap: swap tokens (INJ↔USDT, INJ↔USDC, USDT↔USDC)
- send_token: send INJ to another address
- get_tx_history: view recent transactions

RULES:
1. When the user asks to "swap all" or uses vague amounts, call get_balance FIRST to get the exact amount, then get_swap_quote, then execute_swap.
2. ALWAYS call get_swap_quote before execute_swap so the user sees the expected output.
3. After execute_swap succeeds, always report the transaction hash and the Blockscout explorer link.
4. When the user asks for their address/wallet, call get_wallet_info.
5. Never ask for private keys — they are managed securely by the wallet.
6. After a tool returns results, continue the task autonomously without asking for confirmation again unless it is a destructive action (swap or send).

Respond in the same language the user writes in. Be concise and direct.`,
      tools: AGENT_TOOLS,
      messages: apiMessages,
    });

    return NextResponse.json(response);
  } catch (err) {
    console.error('[agents/route] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
