/**
 * Estimate gas for transactions
 */

import { createPublicClient, http, parseEther, type Address } from 'viem';
import { GasEstimate, TransactionRequest, ChainConfig, DEFAULT_CHAIN } from '@/types/chain';

/**
 * Estimate gas for a transaction
 */
export async function estimateGas(
  from: string,
  to: string,
  value?: string, // in INJ/ETH
  data?: `0x${string}`,
  chain: ChainConfig = DEFAULT_CHAIN
): Promise<GasEstimate> {
  try {
    const client = createPublicClient({
      transport: http(chain.rpcUrl),
    });

    // Get current gas prices
    const gasPrice = await client.getGasPrice();
    
    // Estimate gas limit
    const gasLimit = await client.estimateGas({
      account: from as Address,
      to: to as Address,
      value: value ? parseEther(value) : undefined,
      data: data,
    });

    // Add 20% buffer to gas limit
    const bufferedGasLimit = (gasLimit * 120n) / 100n;

    // For EIP-1559 chains (use gasPrice as fallback)
    const maxFeePerGas = gasPrice;
    const maxPriorityFeePerGas = gasPrice / 10n; // 10% of base fee as priority

    const totalCost = bufferedGasLimit * maxFeePerGas;

    return {
      gasLimit: bufferedGasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
      totalCost,
    };
  } catch (error) {
    throw new Error(
      `Failed to estimate gas: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get current gas prices
 */
export async function getGasPrice(
  chain: ChainConfig = DEFAULT_CHAIN
): Promise<bigint> {
  try {
    const client = createPublicClient({
      transport: http(chain.rpcUrl),
    });

    return await client.getGasPrice();
  } catch (error) {
    throw new Error(
      `Failed to get gas price: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Calculate transaction cost in native currency
 */
export function calculateTransactionCost(
  gasLimit: bigint,
  gasPrice: bigint
): {
  wei: bigint;
  gwei: string;
  eth: string;
} {
  const wei = gasLimit * gasPrice;
  const gwei = Number(wei) / 1e9;
  const eth = Number(wei) / 1e18;

  return {
    wei,
    gwei: gwei.toFixed(9),
    eth: eth.toFixed(18),
  };
}
