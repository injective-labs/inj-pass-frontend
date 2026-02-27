import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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
The user has already authenticated and their wallet is unlocked. You can help them:
- Check balances
- Swap tokens (INJ ↔ USDT ↔ USDC)
- Send INJ to other wallets
- Review transaction history
- Explain DeFi concepts on Injective

IMPORTANT: When you call execute_swap or send_token, the transaction will be confirmed by the user before execution. Always state the exact amounts and addresses clearly. Never ask for or handle private keys — they are managed securely by the wallet.

Respond in the same language the user writes in. Be concise and clear.`,
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
