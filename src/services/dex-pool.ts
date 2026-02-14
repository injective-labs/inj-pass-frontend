/**
 * Alternative approach: Query liquidity pools directly
 * This is a backup if Router getAmountsOut doesn't work
 */

import { createPublicClient, http, type Address } from 'viem';
import { INJECTIVE_MAINNET_CHAIN } from '@/types/chain';
import { PAIR_ABI, FACTORY_ABI } from './dex-abi';

// Factory address - need to find this
const FACTORY_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

/**
 * Get pair address for two tokens
 */
export async function getPairAddress(
  tokenA: Address,
  tokenB: Address
): Promise<Address> {
  const client = createPublicClient({
    chain: INJECTIVE_MAINNET_CHAIN,
    transport: http(),
  });

  const pairAddress = await client.readContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: 'getPair',
    args: [tokenA, tokenB],
  }) as Address;

  return pairAddress;
}

/**
 * Get reserves from a pair
 */
export async function getPairReserves(pairAddress: Address) {
  const client = createPublicClient({
    chain: INJECTIVE_MAINNET_CHAIN,
    transport: http(),
  });

  const reserves = await client.readContract({
    address: pairAddress,
    abi: PAIR_ABI,
    functionName: 'getReserves',
  }) as [bigint, bigint, number];

  const token0 = await client.readContract({
    address: pairAddress,
    abi: PAIR_ABI,
    functionName: 'token0',
  }) as Address;

  const token1 = await client.readContract({
    address: pairAddress,
    abi: PAIR_ABI,
    functionName: 'token1',
  }) as Address;

  return {
    reserve0: reserves[0],
    reserve1: reserves[1],
    token0,
    token1,
  };
}

/**
 * Calculate output amount using x*y=k formula
 */
export function calculateAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): bigint {
  const amountInWithFee = amountIn * BigInt(997); // 0.3% fee
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * BigInt(1000) + amountInWithFee;
  return numerator / denominator;
}
