/**
 * Test the fixed Solidly Router interface
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

// Solidly Router ABI
const ROUTER_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      {
        internalType: 'tuple[]',
        name: 'routes',
        type: 'tuple[]',
        components: [
          { internalType: 'address', name: 'from', type: 'address' },
          { internalType: 'address', name: 'to', type: 'address' },
          { internalType: 'bool', name: 'stable', type: 'bool' },
        ],
      },
    ],
    name: 'getAmountsOut',
    outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

async function testRoutes() {
  console.log('🧪 Testing Solidly Router with routes format...\n');
  
  const client = createPublicClient({
    chain: INJECTIVE_MAINNET_CHAIN,
    transport: http(),
  });

  const tests = [
    {
      name: 'WINJ → USDC (volatile)',
      amountIn: parseUnits('0.1', 18),
      routes: [{ from: WINJ, to: USDC, stable: false }],
    },
    {
      name: 'WINJ → USDT (volatile)',
      amountIn: parseUnits('0.1', 18),
      routes: [{ from: WINJ, to: USDT, stable: false }],
    },
    {
      name: 'USDC → USDT (stable)',
      amountIn: parseUnits('1', 6),
      routes: [{ from: USDC, to: USDT, stable: true }],
    },
    {
      name: 'USDT → USDC (stable)',
      amountIn: parseUnits('1', 6),
      routes: [{ from: USDT, to: USDC, stable: true }],
    },
  ];

  for (const test of tests) {
    console.log(`\n📊 Testing ${test.name}:`);
    console.log('   Amount in:', test.amountIn.toString());
    console.log('   Routes:', JSON.stringify(test.routes, null, 2));

    try {
      const amounts = await client.readContract({
        address: ROUTER_ADDRESS,
        abi: ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [test.amountIn, test.routes],
      });

      console.log('   ✅ Success!');
      console.log('   Amounts:', (amounts as any[]).map(a => a.toString()));
      console.log('   Expected output:', (amounts as any[])[1].toString());
    } catch (error: any) {
      console.log('   ❌ Failed:', error.message);
    }
  }

  console.log('\n✨ All tests completed!\n');
}

testRoutes().catch(console.error);
