/**
 * Debug script to test Pumex Router contract
 * 
 * This script helps diagnose what's wrong with the Router calls
 */

import { createPublicClient, http, type Address, parseUnits } from 'viem';

const INJECTIVE_MAINNET_CHAIN = {
  id: 1776,
  name: 'Injective EVM',
  nativeCurrency: { name: 'Injective', symbol: 'INJ', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sentry.evm-rpc.injective.network/'] },
  },
};

const ROUTER_ADDRESS = '0xC7247df0e97353D676d78f1cc55D3CE39eE32bE1' as Address;
const WINJ = '0x0000000088827d2d103ee2d9A6b781773AE03FfB' as Address;
const USDC = '0x2a25fbD67b3aE485e461fe55d9DbeF302B7D3989' as Address;
const USDT = '0x88f7F2b685F9692caf8c478f5BADF09eE9B1Cc13' as Address;

async function testRouter() {
  console.log('🧪 Testing Pumex Router...\n');
  
  const client = createPublicClient({
    chain: INJECTIVE_MAINNET_CHAIN,
    transport: http(),
  });

  // Test 1: Check if contract exists
  console.log('1️⃣ Checking if Router contract exists...');
  try {
    const code = await client.getBytecode({ address: ROUTER_ADDRESS });
    if (code && code !== '0x') {
      console.log('✅ Contract exists\n');
    } else {
      console.log('❌ No contract at this address\n');
      return;
    }
  } catch (error) {
    console.error('❌ Failed to check contract:', error);
    return;
  }

  // Test 2: Try to call WETH() to get wrapped token address
  console.log('2️⃣ Testing WETH() function...');
  try {
    const weth = await client.readContract({
      address: ROUTER_ADDRESS,
      abi: [
        {
          inputs: [],
          name: 'WETH',
          outputs: [{ type: 'address' }],
          stateMutability: 'pure',
          type: 'function',
        },
      ],
      functionName: 'WETH',
    });
    console.log('✅ WETH address:', weth, '\n');
  } catch (error) {
    console.log('⚠️ WETH() failed:', error instanceof Error ? error.message : error, '\n');
  }

  // Test 3: Try factory()
  console.log('3️⃣ Testing factory() function...');
  try {
    const factory = await client.readContract({
      address: ROUTER_ADDRESS,
      abi: [
        {
          inputs: [],
          name: 'factory',
          outputs: [{ type: 'address' }],
          stateMutability: 'view',
          type: 'function',
        },
      ],
      functionName: 'factory',
    });
    console.log('✅ Factory address:', factory, '\n');
  } catch (error) {
    console.log('⚠️ factory() failed:', error instanceof Error ? error.message : error, '\n');
  }

  // Test 4: Try getAmountsOut with WINJ -> USDC (known to work)
  console.log('4️⃣ Testing getAmountsOut() for WINJ -> USDC...');
  const amount = parseUnits('0.1', 18); // 0.1 WINJ
  const path = [WINJ, USDC];
  
  console.log('Parameters:', {
    amountIn: amount.toString(),
    path,
  });

  try {
    const amounts = await client.readContract({
      address: ROUTER_ADDRESS,
      abi: [
        {
          inputs: [
            { name: 'amountIn', type: 'uint256' },
            { name: 'path', type: 'address[]' },
          ],
          name: 'getAmountsOut',
          outputs: [{ name: 'amounts', type: 'uint256[]' }],
          stateMutability: 'view',
          type: 'function',
        },
      ],
      functionName: 'getAmountsOut',
      args: [amount, path],
    });
    console.log('✅ getAmountsOut succeeded!');
    console.log('Amounts:', amounts);
    console.log('Expected output:', amounts[1].toString(), '\n');
  } catch (error: any) {
    console.log('❌ getAmountsOut failed');
    console.error('Error:', error.message || error);
    console.log('\n📋 Possible reasons:');
    console.log('1. Pair WINJ/USDC does not exist in Pumex');
    console.log('2. Router uses different function signature');
    console.log('3. Need to use different parameters\n');
  }

  // Test 5: Try with USDC -> USDT
  console.log('5️⃣ Testing getAmountsOut() for USDC -> USDT...');
  const usdcAmount = parseUnits('1', 6); // 1 USDC
  const usdcPath = [USDC, USDT];

  try {
    const amounts = await client.readContract({
      address: ROUTER_ADDRESS,
      abi: [
        {
          inputs: [
            { name: 'amountIn', type: 'uint256' },
            { name: 'path', type: 'address[]' },
          ],
          name: 'getAmountsOut',
          outputs: [{ name: 'amounts', type: 'uint256[]' }],
          stateMutability: 'view',
          type: 'function',
        },
      ],
      functionName: 'getAmountsOut',
      args: [usdcAmount, usdcPath],
    });
    console.log('✅ getAmountsOut succeeded!');
    console.log('Amounts:', amounts, '\n');
  } catch (error: any) {
    console.log('❌ USDC -> USDT also failed');
    console.log('Error:', error.message || error, '\n');
  }

  // Test 6: Check actual transaction input data
  console.log('6️⃣ Known working transaction analysis:');
  console.log('Transaction: 0x2d16978b8ab06a257792f67d5b92072db7dcae18162168c75974a09d1cac8e55');
  console.log('- From: User wallet');
  console.log('- To: RouterV2 (0xC724...)');
  console.log('- Input: 0.2 INJ');
  console.log('- Output: 0.622908 USDC');
  console.log('- Pool: VolatileV1 AMM - WINJ/UUSDC');
  console.log('\n💡 This transaction succeeded, so the Router works.');
  console.log('   We need to find the correct function name and parameters.\n');
}

testRouter().catch(console.error);
