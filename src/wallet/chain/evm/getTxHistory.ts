/**
 * Get transaction history for an address using Blockscout API
 */

import { createPublicClient, http } from 'viem';
import { TransactionHistory, ChainConfig, DEFAULT_CHAIN } from '@/types/chain';

// Blockscout API Response Types
interface BlockscoutAddressInfo {
  hash: string;
  name?: string;
  is_contract?: boolean;
}

interface BlockscoutTransaction {
  hash: string;
  from: BlockscoutAddressInfo;
  to: BlockscoutAddressInfo | null;
  value: string;
  timestamp: string;
  block_number: number;
  status: 'ok' | 'error';
  gas_used?: string;
  gas_price?: string;
  method?: string;
}

interface BlockscoutResponse {
  items: BlockscoutTransaction[];
  next_page_params?: {
    block_number: number;
    index: number;
    items_count: number;
  };
}

/**
 * Get recent transactions for an address using Blockscout API
 * 
 * @param address - Address to query (0x... format)
 * @param limit - Maximum number of transactions to return (not directly supported, fetches pages of 50)
 * @param chain - Chain configuration
 */
export async function getTxHistory(
  address: string,
  limit: number = 50,
  chain: ChainConfig = DEFAULT_CHAIN
): Promise<TransactionHistory[]> {
  try {
    // Use our Next.js API route to avoid CORS issues
    const apiUrl = `/api/transactions?address=${address}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // If the API fails, return empty array instead of throwing
      console.warn(`getTxHistory: API request failed with status ${response.status}`);
      return [];
    }

    const data: BlockscoutResponse = await response.json();

    // Transform Blockscout response to our TransactionHistory format
    const transactions: TransactionHistory[] = data.items.map((tx) => {
      // Parse timestamp to Unix timestamp (seconds)
      const timestamp = Math.floor(new Date(tx.timestamp).getTime() / 1000);

      return {
        hash: tx.hash,
        from: tx.from.hash,
        to: tx.to?.hash || null,
        value: tx.value,
        timestamp,
        blockNumber: tx.block_number,
        status: tx.status === 'ok' ? 'success' : 'failed',
        gasUsed: tx.gas_used,
        gasPrice: tx.gas_price,
      };
    });

    // Limit to requested amount
    return transactions.slice(0, limit);
  } catch (error) {
    console.error('getTxHistory error:', error);
    // Return empty array instead of throwing to prevent UI breakage
    return [];
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
