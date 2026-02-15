/**
 * Helper script to find Pumex Router address
 * 
 * This script helps you verify a potential Router address by checking:
 * 1. If it's a contract
 * 2. If it has the expected Router methods
 * 
 * Usage:
 * 1. Replace POTENTIAL_ROUTER_ADDRESS with the address you found
 * 2. Run: npx ts-node scripts/find-router.ts
 */

import { createPublicClient, http, type Address } from 'viem';

// Pumex RouterV2 address on Injective EVM Mainnet
// Found from transaction: 0x2d16978b8ab06a257792f67d5b92072db7dcae18162168c75974a09d1cac8e55
const POTENTIAL_ROUTER_ADDRESS = '0xC7247df0e97353D676d78f1cc55D3CE39eE32bE1' as Address;

const INJECTIVE_MAINNET = {
  id: 1776,
  name: 'Injective EVM',
  rpcUrls: {
    default: { http: ['https://sentry.evm-rpc.injective.network/'] },
  },
  nativeCurrency: {
    name: 'Injective',
    symbol: 'INJ',
    decimals: 18,
  },
};

// Expected Router function signatures
const EXPECTED_METHODS = [
  'getAmountsOut(uint256,address[])',
  'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
  'swapExactETHForTokens(uint256,address[],address,uint256)',
];

async function checkRouterAddress() {
  console.log('🔍 Checking Router Address...\n');
  console.log(`Address: ${POTENTIAL_ROUTER_ADDRESS}\n`);

  const client = createPublicClient({
    chain: INJECTIVE_MAINNET,
    transport: http(),
  });

  try {
    // 1. Check if it's a contract
    console.log('1️⃣ Checking if address is a contract...');
    const code = await client.getBytecode({
      address: POTENTIAL_ROUTER_ADDRESS,
    });

    if (!code || code === '0x') {
      console.log('❌ This is NOT a contract (no bytecode found)');
      console.log('\n💡 Tips:');
      console.log('   - Make sure you copied the correct address');
      console.log('   - This might be a regular wallet address, not a Router');
      console.log('   - Try finding the Router address through Pumex dApp');
      return;
    }

    console.log('✅ This IS a contract\n');

    // 2. Try to call a standard Router method
    console.log('2️⃣ Checking for Router methods...');
    
    try {
      // Try to call WETH() - most routers have this
      const wethResult = await client.readContract({
        address: POTENTIAL_ROUTER_ADDRESS,
        abi: [
          {
            inputs: [],
            name: 'WETH',
            outputs: [{ internalType: 'address', name: '', type: 'address' }],
            stateMutability: 'pure',
            type: 'function',
          },
        ],
        functionName: 'WETH',
      });

      console.log(`✅ Found WETH() method → Returns: ${wethResult}`);
    } catch (error) {
      console.log('⚠️  Could not call WETH() - might use different method name');
    }

    try {
      // Try to get factory address
      const factoryResult = await client.readContract({
        address: POTENTIAL_ROUTER_ADDRESS,
        abi: [
          {
            inputs: [],
            name: 'factory',
            outputs: [{ internalType: 'address', name: '', type: 'address' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'factory',
      });

      console.log(`✅ Found factory() method → Returns: ${factoryResult}`);
    } catch (error) {
      console.log('⚠️  Could not call factory() - might use different architecture');
    }

    console.log('\n3️⃣ Testing quote functionality...');
    
    try {
      // Try to get a quote for INJ -> USDT
      const WINJ = '0x0000000088827d2d103ee2d9A6b781773AE03FfB';
      const USDT = '0x88f7F2b685F9692caf8c478f5BADF09eE9B1Cc13';
      const amount = BigInt('1000000000000000000'); // 1 INJ

      const amounts = await client.readContract({
        address: POTENTIAL_ROUTER_ADDRESS,
        abi: [
          {
            inputs: [
              { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
              { internalType: 'address[]', name: 'path', type: 'address[]' },
            ],
            name: 'getAmountsOut',
            outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'getAmountsOut',
        args: [amount, [WINJ, USDT]],
      });

      console.log('✅ Successfully got quote for INJ -> USDT swap!');
      console.log(`   Input: 1 INJ`);
      console.log(`   Output: ${Number(amounts[1]) / 1e6} USDT`);
      
      console.log('\n✨ SUCCESS! This appears to be a valid Router address!\n');
      console.log('📝 Next steps:');
      console.log(`   1. Copy this address: ${POTENTIAL_ROUTER_ADDRESS}`);
      console.log('   2. Open: frontend/src/services/dex-swap.ts');
      console.log('   3. Replace ROUTER_ADDRESS with this address');
      console.log('   4. Save and test the swap functionality');

    } catch (error) {
      console.log('❌ Could not get swap quote');
      console.log('   Error:', error instanceof Error ? error.message : 'Unknown error');
      console.log('\n💡 This might not be a Router, or the path might be wrong');
      console.log('   - Check if this is the correct contract');
      console.log('   - Verify the token pair has liquidity');
    }

  } catch (error) {
    console.error('\n❌ Error checking address:', error);
    console.log('\n💡 Tips:');
    console.log('   - Check your internet connection');
    console.log('   - Verify the RPC endpoint is accessible');
    console.log('   - Try again in a few moments');
  }
}

async function findRouterByTransaction() {
  console.log('\n📋 How to find Router address from Pumex dApp:\n');
  console.log('1. Visit Pumex dApp in your browser');
  console.log('2. Open Developer Tools (F12)');
  console.log('3. Go to Network tab');
  console.log('4. Try to make a swap');
  console.log('5. Look for "eth_sendTransaction" or similar request');
  console.log('6. Find the "to" field in the request - that\'s the Router address');
  console.log('7. Copy the address and paste it in POTENTIAL_ROUTER_ADDRESS above');
  console.log('\nAlternatively, check:');
  console.log('- Pumex documentation: https://pumex.gitbook.io/pumex-docs');
  console.log('- Injective block explorer: https://blockscout.injective.network/');
  console.log('- Pumex community channels (Telegram/Discord)');
}

// Run the check
if (POTENTIAL_ROUTER_ADDRESS === '0x0000000000000000000000000000000000000000') {
  console.log('⚠️  Please configure POTENTIAL_ROUTER_ADDRESS first!\n');
  findRouterByTransaction();
} else {
  checkRouterAddress();
}
