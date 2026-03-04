/**
 * GET /api/faucet/balance
 *
 * Returns the faucet hot-wallet balance for every supported network.
 * No authentication required — balances are public information.
 *
 * @author Alex <jsxj81@163.com>
 */

import { NextResponse } from 'next/server';
import { createPublicClient, http, formatEther } from 'viem';
import { FAUCET_NETWORKS } from '@/config/faucet';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const walletAddress = process.env.FAUCET_WALLET_ADDRESS;

  if (!walletAddress) {
    return NextResponse.json(
      { error: 'Faucet wallet not configured' },
      { status: 500 }
    );
  }

  const results = await Promise.allSettled(
    FAUCET_NETWORKS.map(async (network) => {
      const client = createPublicClient({
        transport: http(network.rpcUrl, { timeout: 8_000 }),
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

  const balances = results.map((result, i) => {
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

  return NextResponse.json({ balances });
}
