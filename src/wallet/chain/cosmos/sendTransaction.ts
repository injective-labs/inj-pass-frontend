/**
 * Send Cosmos transaction using Injective SDK
 * All signing happens on the client side
 */

import {
  ChainRestAuthApi,
  createTransaction,
  MsgSend,
  TxClient,
  BaseAccount,
  PrivateKey,
} from '@injectivelabs/sdk-ts';
import { ACTIVE_NETWORK } from '@/config/network';

const COSMOS_LCD = ACTIVE_NETWORK.lcdUrl;
const COSMOS_CHAIN_ID = ACTIVE_NETWORK.cosmosChainId;

const DEFAULT_FEE = {
  amount: [{ denom: 'inj', amount: '5000000000000000' }],
  gas: '200000',
};

/**
 * Send a Cosmos transaction
 *
 * @param privateKey - Private key bytes (32 bytes)
 * @param to - Recipient Cosmos address (inj1...)
 * @param value - Amount to send (in INJ as string)
 */
export async function sendCosmosTransaction(
  privateKey: Uint8Array,
  to: string,
  value: string
): Promise<string> {
  try {
    const privateKeyHex = Array.from(privateKey)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const privateKeyInstance = PrivateKey.fromHex(privateKeyHex);
    const injectiveAddress = privateKeyInstance.toBech32();

    const chainRestAuthApi = new ChainRestAuthApi(COSMOS_LCD);

    const accountDetailsResponse = await chainRestAuthApi.fetchAccount(injectiveAddress);
    const baseAccount = BaseAccount.fromRestApi(accountDetailsResponse);

    const amountInWei = BigInt(Math.floor(parseFloat(value) * 1e18));

    const msg = MsgSend.fromJSON({
      amount: {
        denom: 'inj',
        amount: amountInWei.toString(),
      },
      srcInjectiveAddress: injectiveAddress,
      dstInjectiveAddress: to,
    });

    const { signBytes, txRaw } = createTransaction({
      message: msg,
      memo: '',
      fee: DEFAULT_FEE,
      pubKey: privateKeyInstance.toPublicKey().toBase64(),
      sequence: baseAccount.sequence,
      accountNumber: baseAccount.accountNumber,
      chainId: COSMOS_CHAIN_ID,
    });

    const signature = await privateKeyInstance.sign(Buffer.from(signBytes));

    txRaw.signatures = [signature];

    const txClient = new (TxClient as any)(COSMOS_LCD);
    const response = await txClient.broadcast(txRaw) as { code: number; txHash: string; rawLog?: string; message?: string };

    if (response.code !== 0) {
      throw new Error(`Transaction failed: ${response.rawLog || response.message || 'Unknown error'}`);
    }

    return response.txHash;
  } catch (error) {
    throw new Error(
      `Failed to send Cosmos transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
