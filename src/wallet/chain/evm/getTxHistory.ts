/**
 * Get transaction history for an address
 * 
 * Note: Basic implementation using RPC calls
 * For production, consider using block explorer API (e.g., Etherscan-like API)
 */

import { createPublicClient, http, type Address, type Block } from 'viem';
import { TransactionHistory, ChainConfig, DEFAULT_CHAIN } from '@/types/chain';

/**
 * Get recent transactions for an address
 * 
 * @param address - Address to query
 * @param limit - Maximum number of transactions to return
 * @param chain - Chain configuration
 */
export async function getTxHistory(
  address: string,
  limit: number = 10,
  chain: ChainConfig = DEFAULT_CHAIN
): Promise<TransactionHistory[]> {
  try {
    const client = createPublicClient({
      transport: http(chain.rpcUrl),
    });

    const currentBlock = await client.getBlockNumber();
    const transactions: TransactionHistory[] = [];

    // Reduce blocks to scan from 100 to 20 for better performance
    const blocksToScan = Math.min(20, Number(currentBlock));

    for (let i = 0; i < blocksToScan && transactions.length < limit; i++) {
      const blockNumber = currentBlock - BigInt(i);
      
      try {
        const block = await client.getBlock({
          blockNumber,
          includeTransactions: true,
        });

        if (!block.transactions || block.transactions.length === 0) {
          continue;
        }

        // Filter transactions involving the address
        for (const tx of block.transactions) {
          if (typeof tx === 'string') continue;

          const isFrom = tx.from.toLowerCase() === address.toLowerCase();
          const isTo = tx.to?.toLowerCase() === address.toLowerCase();

          if (isFrom || isTo) {
            transactions.push({
              hash: tx.hash,
              from: tx.from,
              to: tx.to || null,
              value: tx.value.toString(),
              timestamp: Number(block.timestamp),
              blockNumber: Number(block.number),
              status: 'success', // Would need receipt to confirm
              gasUsed: tx.gas?.toString(),
              gasPrice: tx.gasPrice?.toString(),
            });

            if (transactions.length >= limit) {
              break;
            }
          }
        }
      } catch (blockError) {
        // Skip failed block fetches
        console.warn(`Failed to fetch block ${blockNumber}:`, blockError);
        continue;
      }
    }

    return transactions.slice(0, limit);
  } catch (error) {
    throw new Error(
      `Failed to get transaction history: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get transaction receipt to check status
 */
export async function getTransactionStatus(
  txHash: string,
  chain: ChainConfig = DEFAULT_CHAIN
): Promise<'pending' | 'success' | 'failed'> {
  try {
    const client = createPublicClient({
      transport: http(chain.rpcUrl),
    });

    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    return receipt.status === 'success' ? 'success' : 'failed';
  } catch (error) {
    // If receipt not found, transaction is likely pending
    return 'pending';
  }
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(
  txHash: string,
  chain: ChainConfig = DEFAULT_CHAIN,
  confirmations: number = 1
): Promise<TransactionHistory> {
  try {
    const client = createPublicClient({
      transport: http(chain.rpcUrl),
    });

    const receipt = await client.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      confirmations,
    });

    const block = await client.getBlock({
      blockHash: receipt.blockHash,
    });

    return {
      hash: receipt.transactionHash,
      from: receipt.from,
      to: receipt.to || null,
      value: '0', // Would need full tx data
      timestamp: Number(block.timestamp),
      blockNumber: Number(receipt.blockNumber),
      status: receipt.status === 'success' ? 'success' : 'failed',
      gasUsed: receipt.gasUsed.toString(),
      gasPrice: receipt.effectiveGasPrice.toString(),
    };
  } catch (error) {
    throw new Error(
      `Failed to wait for transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
