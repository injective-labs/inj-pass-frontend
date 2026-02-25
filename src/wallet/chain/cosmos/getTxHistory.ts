/**
 * Get transaction history for a Cosmos address using Injective LCD API
 */

import { TransactionHistory } from '@/types/chain';

// Injective LCD API Response Types
interface CosmosTxResponse {
  tx: {
    body: {
      messages: Array<{
        '@type': string;
        from_address?: string;
        to_address?: string;
        sender?: string;
        receiver?: string;
        amount?: Array<{
          denom: string;
          amount: string;
        }>;
      }>;
    };
  };
  tx_response: {
    txhash: string;
    code: number;
    timestamp: string;
    height: string;
    gas_used: string;
    gas_wanted: string;
  };
}

interface CosmosTxHistoryResponse {
  txs: CosmosTxResponse[];
  pagination?: {
    next_key?: string | null;
    total?: string;
  };
}

/**
 * Get recent transactions for a Cosmos address using Injective LCD API
 * 
 * @param address - Cosmos address (inj1... format)
 * @param limit - Maximum number of transactions to return
 */
export async function getCosmosTxHistory(
  address: string,
  limit: number = 50
): Promise<TransactionHistory[]> {
  try {
    // Use our Next.js API route to avoid CORS issues
    const apiUrl = `/api/cosmos-transactions?address=${address}&limit=${limit}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`getCosmosTxHistory: API request failed with status ${response.status}`);
      return [];
    }

    const data: CosmosTxHistoryResponse = await response.json();

    // Helper function to transform a single transaction
    const transformTransaction = (tx: CosmosTxResponse): (TransactionHistory & { isSwap?: boolean }) | null => {
      const txResponse = tx.tx_response;
      const messages = tx.tx.body.messages || [];

      // Find send/receive messages - check for MsgSend and swap messages
      let sendMessage: any = null;
      let receiveMessage: any = null;
      let isSwap = false;

      for (const msg of messages) {
        const msgType = msg['@type'] || '';
        
        // Check for swap messages (Exchange module)
        if (msgType.includes('MsgExchange') || msgType.includes('MsgSwap')) {
          isSwap = true;
          // For swaps, we'll treat it as a send if the user is the sender
          if (msg.sender === address || msg.from_address === address) {
            sendMessage = msg;
          }
        }
        
        // Check for regular send messages
        if (msgType.includes('MsgSend')) {
          if (msg.from_address === address || msg.sender === address) {
            sendMessage = msg;
          }
          if (msg.to_address === address || msg.receiver === address) {
            receiveMessage = msg;
          }
        }
      }

      // Determine transaction type and addresses
      let fromAddress: string = address;
      let toAddress: string | null = null;
      let value: string = '0';

      if (sendMessage) {
        fromAddress = sendMessage.from_address || sendMessage.sender || address;
        toAddress = sendMessage.to_address || sendMessage.receiver || null;
        // Get INJ amount from message
        // INJ denom in Cosmos is typically 'inj' with 18 decimals
        const injAmount = sendMessage.amount?.find(
          (a: any) => a.denom === 'inj' || a.denom === 'inj1' || a.denom?.toLowerCase().includes('inj')
        );
        if (injAmount) {
          // INJ in Cosmos uses 18 decimals, same as EVM
          value = BigInt(injAmount.amount).toString();
        }
      } else if (receiveMessage) {
        fromAddress = receiveMessage.from_address || receiveMessage.sender || '';
        toAddress = receiveMessage.to_address || receiveMessage.receiver || address;
        const injAmount = receiveMessage.amount?.find(
          (a: any) => a.denom === 'inj' || a.denom === 'inj1' || a.denom?.toLowerCase().includes('inj')
        );
        if (injAmount) {
          value = BigInt(injAmount.amount).toString();
        }
      }

      // Skip if no INJ amount found and not a swap
      if (value === '0' && !isSwap) {
        return null;
      }

      // Parse timestamp to Unix timestamp (seconds)
      const timestamp = Math.floor(new Date(txResponse.timestamp).getTime() / 1000);

      // Create transaction object with swap flag included
      return {
        hash: txResponse.txhash,
        from: fromAddress,
        to: toAddress,
        value,
        timestamp,
        blockNumber: parseInt(txResponse.height, 10),
        status: txResponse.code === 0 ? 'success' : 'failed',
        gasUsed: txResponse.gas_used,
        gasPrice: undefined, // Cosmos doesn't have gas price in the same way
        isSwap, // Add swap flag as a property
      };
    };

    // Transform Cosmos transactions to our TransactionHistory format
    const transactions: TransactionHistory[] = data.txs
      .map(transformTransaction)
      .filter((tx): tx is TransactionHistory => tx !== null && (tx.value !== '0' || tx.from !== address || tx.to !== address))
      .slice(0, limit);

    return transactions;
  } catch (error) {
    console.error('getCosmosTxHistory error:', error);
    return [];
  }
}

