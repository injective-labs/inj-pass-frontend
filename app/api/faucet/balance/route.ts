/**
 * GET /api/faucet/balance
 *
 * Returns the faucet hot-wallet balance for every supported network.
 * Results are cached in-process for 30 seconds to avoid hammering
 * public testnet RPCs on every page visit.
 *
 * @author Alex <jsxj81@163.com>
 */

import { NextResponse } from 'next/server';
import { createPublicClient, http, formatEther } from 'viem';
import { FAUCET_NETWORKS } from '@/config/faucet';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CachedBalance {
  id: string;
  symbol: string;
  chainName: string;
  amount: string;
  balance: string;
  color: string;
  isBase: boolean;
}

const CACHE_TTL_MS = 30_000;
const RPC_TIMEOUT_MS = 4_000;

const g = globalThis as unknown as {
  __faucetBalanceCache?: { ts: number; data: CachedBalance[] };
};

export async function GET() {
  const walletAddress = process.env.FAUCET_WALLET_ADDRESS;

  if (!walletAddress) {
    return NextResponse.json(
      { error: 'Faucet wallet not configured' },
      { status: 500 }
    );
  }

  // Return cached data if fresh enough
  if (g.__faucetBalanceCache && Date.now() - g.__faucetBalanceCache.ts < CACHE_TTL_MS) {
    return NextResponse.json({ balances: g.__faucetBalanceCache.data });
  }

  const results = await Promise.allSettled(
    FAUCET_NETWORKS.map(async (network) => {
      const client = createPublicClient({
        transport: http(network.rpcUrl, { timeout: RPC_TIMEOUT_MS }),
      });

      const raw = await client.getBalance({
        address: walletAddress as `0x${string}`,
      });

      return {
        id: network.id,
        symbol: network.symbol,
        chainName: network.chainName,
        amount: network.amount,
        balance: formatEther(raw),
        color: network.color,
        isBase: network.isBase,
      };
    })
  );

  const balances: CachedBalance[] = results.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    return {
      id: FAUCET_NETWORKS[i].id,
      symbol: FAUCET_NETWORKS[i].symbol,
      chainName: FAUCET_NETWORKS[i].chainName,
      amount: FAUCET_NETWORKS[i].amount,
      balance: '0',
      color: FAUCET_NETWORKS[i].color,
      isBase: FAUCET_NETWORKS[i].isBase,
    };
  });

  g.__faucetBalanceCache = { ts: Date.now(), data: balances };

  return NextResponse.json({ balances });
}
