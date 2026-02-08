/**
 * Test page for chain interactions
 * Test wallet operations: getBalance, sendTransaction, etc.
 */

'use client';

import { useState } from 'react';
import { importPrivateKey } from '@/wallet/key-management';
import { getBalance, estimateGas, sendTransaction, getTxHistory } from '@/wallet/chain';
import { INJECTIVE_TESTNET } from '@/types/chain';

export default function TestChainPage() {
  const [output, setOutput] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [privateKey, setPrivateKey] = useState('');
  const [address, setAddress] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('0.001');

  const log = (message: string) => {
    setOutput((prev) => [...prev, message]);
    console.log(message);
  };

  const handleImportKey = async () => {
    try {
      setLoading(true);
      log('🔑 Importing private key...');
      
      const result = importPrivateKey(privateKey);
      setAddress(result.address);
      
      log(`✅ Address: ${result.address}`);
    } catch (error) {
      log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGetBalance = async () => {
    if (!address) {
      log('❌ Please import private key first');
      return;
    }

    try {
      setLoading(true);
      log(`💰 Getting balance for ${address}...`);
      
      const balance = await getBalance(address, INJECTIVE_TESTNET);
      
      log(`✅ Balance: ${balance.formatted} ${balance.symbol}`);
      log(`   Raw: ${balance.value.toString()} wei`);
    } catch (error) {
      log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEstimateGas = async () => {
    if (!address || !recipientAddress) {
      log('❌ Please import key and enter recipient address');
      return;
    }

    try {
      setLoading(true);
      log(`⛽ Estimating gas...`);
      
      const estimate = await estimateGas(
        address,
        recipientAddress,
        amount,
        undefined,
        INJECTIVE_TESTNET
      );
      
      log(`✅ Gas Limit: ${estimate.gasLimit.toString()}`);
      log(`   Max Fee: ${estimate.maxFeePerGas.toString()} wei`);
      log(`   Priority Fee: ${estimate.maxPriorityFeePerGas.toString()} wei`);
      log(`   Total Cost: ${Number(estimate.totalCost) / 1e18} INJ`);
    } catch (error) {
      log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTransaction = async () => {
    if (!privateKey || !recipientAddress) {
      log('❌ Please import key and enter recipient address');
      return;
    }

    try {
      setLoading(true);
      log(`📤 Sending ${amount} INJ to ${recipientAddress}...`);
      
      const imported = importPrivateKey(privateKey);
      const hash = await sendTransaction(
        imported.privateKey,
        recipientAddress,
        amount,
        undefined,
        INJECTIVE_TESTNET
      );
      
      log(`✅ Transaction sent!`);
      log(`   Hash: ${hash}`);
      log(`   Explorer: ${INJECTIVE_TESTNET.explorerUrl}/tx/${hash}`);
    } catch (error) {
      log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGetHistory = async () => {
    if (!address) {
      log('❌ Please import private key first');
      return;
    }

    try {
      setLoading(true);
      log(`📜 Getting transaction history...`);
      
      const history = await getTxHistory(address, 5, INJECTIVE_TESTNET);
      
      if (history.length === 0) {
        log('   No transactions found');
      } else {
        log(`✅ Found ${history.length} transactions:`);
        history.forEach((tx, i) => {
          log(`   ${i + 1}. ${tx.hash}`);
          log(`      From: ${tx.from}`);
          log(`      To: ${tx.to}`);
          log(`      Value: ${Number(tx.value) / 1e18} INJ`);
          log(`      Block: ${tx.blockNumber}`);
        });
      }
    } catch (error) {
      log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>⛓️ Chain Interaction Test</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Network: {INJECTIVE_TESTNET.name} ({INJECTIVE_TESTNET.id})
      </p>

      {/* Private Key Input */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Private Key (0x...)
        </label>
        <input
          type="password"
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
          placeholder="0x..."
          style={{
            width: '100%',
            padding: '0.5rem',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
        <button
          onClick={handleImportKey}
          disabled={loading || !privateKey}
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: loading ? '#ccc' : '#0066FF',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          Import Key
        </button>
        {address && (
          <div style={{ marginTop: '0.5rem', color: '#0066FF' }}>
            Address: {address}
          </div>
        )}
      </div>

      {/* Transaction Inputs */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Recipient Address
        </label>
        <input
          type="text"
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          placeholder="0x..."
          style={{
            width: '100%',
            padding: '0.5rem',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
            marginBottom: '0.5rem',
          }}
        />
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Amount (INJ)
        </label>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.001"
          style={{
            width: '100%',
            padding: '0.5rem',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button onClick={handleGetBalance} disabled={loading} style={buttonStyle}>
          Get Balance
        </button>
        <button onClick={handleEstimateGas} disabled={loading} style={buttonStyle}>
          Estimate Gas
        </button>
        <button onClick={handleSendTransaction} disabled={loading} style={buttonStyle}>
          Send Transaction
        </button>
        <button onClick={handleGetHistory} disabled={loading} style={buttonStyle}>
          Get History
        </button>
        <button
          onClick={() => setOutput([])}
          disabled={loading}
          style={{ ...buttonStyle, backgroundColor: '#666' }}
        >
          Clear
        </button>
      </div>

      {/* Output */}
      <div
        style={{
          backgroundColor: '#000',
          color: '#0f0',
          padding: '1rem',
          borderRadius: '8px',
          minHeight: '400px',
          maxHeight: '600px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          fontSize: '0.875rem',
          lineHeight: '1.5',
        }}
      >
        {output.length === 0 ? (
          <div style={{ color: '#666' }}>Ready. Import a private key to start...</div>
        ) : (
          output.map((line, i) => <div key={i}>{line}</div>)
        )}
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  backgroundColor: '#0066FF',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.875rem',
};
