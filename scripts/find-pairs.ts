/**
 * Find available pairs in Pumex Factory
 */

import { createPublicClient, http, type Address } from 'viem';

const INJECTIVE_MAINNET_CHAIN = {
  id: 1776,
  name: 'Injective EVM',
  nativeCurrency: { name: 'Injective', symbol: 'INJ', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sentry.evm-rpc.injective.network/'] },
  },
};

const FACTORY_ADDRESS = '0x105A0A9c1D9e29e0D68B746538895c94468108d2' as Address;
const WINJ = '0x0000000088827d2d103ee2d9A6b781773AE03FfB' as Address;
const USDC = '0x2a25fbD67b3aE485e461fe55d9DbeF302B7D3989' as Address;
const USDT = '0x88f7F2b685F9692caf8c478f5BADF09eE9B1Cc13' as Address;

const FACTORY_ABI = [
  {
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'stable', type: 'bool' },
    ],
    name: 'getPair',
    outputs: [{ name: 'pair', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'allPairsLength',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'index', type: 'uint256' }],
    name: 'allPairs',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const PAIR_ABI = [
  {
    inputs: [],
    name: 'token0',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token1',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'stable',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getReserves',
    outputs: [
      { name: 'reserve0', type: 'uint256' },
      { name: 'reserve1', type: 'uint256' },
      { name: 'blockTimestampLast', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

async function findPairs() {
  console.log('🔍 Searching for Pumex pairs...\n');

  const client = createPublicClient({
    chain: INJECTIVE_MAINNET_CHAIN,
    transport: http(),
  });

  // Test if this is Solidly-style factory (with stable parameter)
  console.log('Testing pair lookups with stable parameter:\n');

  const pairs = [
    { name: 'WINJ/USDC', tokenA: WINJ, tokenB: USDC },
    { name: 'WINJ/USDT', tokenA: WINJ, tokenB: USDT },
    { name: 'USDC/USDT', tokenA: USDC, tokenB: USDT },
  ];

  for (const { name, tokenA, tokenB } of pairs) {
    console.log(`\n📊 ${name}:`);

    // Try volatile (stable=false)
    try {
      const volatilePair = await client.readContract({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: 'getPair',
        args: [tokenA, tokenB, false],
      }) as Address;

      if (volatilePair !== '0x0000000000000000000000000000000000000000') {
        console.log('  ✅ Volatile pair:', volatilePair);

        // Get pair info
        try {
          const [token0, token1, stable, reserves] = await Promise.all([
            client.readContract({
              address: volatilePair,
              abi: PAIR_ABI,
              functionName: 'token0',
            }),
            client.readContract({
              address: volatilePair,
              abi: PAIR_ABI,
              functionName: 'token1',
            }),
            client.readContract({
              address: volatilePair,
              abi: PAIR_ABI,
              functionName: 'stable',
            }),
            client.readContract({
              address: volatilePair,
              abi: PAIR_ABI,
              functionName: 'getReserves',
            }),
          ]);

          console.log('     token0:', token0);
          console.log('     token1:', token1);
          console.log('     stable:', stable);
          console.log('     reserve0:', (reserves as any)[0].toString());
          console.log('     reserve1:', (reserves as any)[1].toString());
        } catch (err) {
          console.log('     ⚠️ Could not read pair details');
        }
      } else {
        console.log('  ❌ No volatile pair found');
      }
    } catch (error: any) {
      console.log('  ❌ Volatile pair lookup failed:', error.message);
    }

    // Try stable (stable=true)
    try {
      const stablePair = await client.readContract({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: 'getPair',
        args: [tokenA, tokenB, true],
      }) as Address;

      if (stablePair !== '0x0000000000000000000000000000000000000000') {
        console.log('  ✅ Stable pair:', stablePair);
      } else {
        console.log('  ❌ No stable pair found');
      }
    } catch (error: any) {
      console.log('  ❌ Stable pair lookup failed:', error.message);
    }
  }

  // Try to get all pairs
  console.log('\n\n📋 Listing all pairs in factory...');
  try {
    const pairCount = await client.readContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'allPairsLength',
    }) as bigint;

    console.log(`Total pairs: ${pairCount.toString()}`);

    if (pairCount > 0n) {
      const maxToShow = pairCount > 20n ? 20n : pairCount;
      console.log(`\nShowing first ${maxToShow} pairs:\n`);

      for (let i = 0n; i < maxToShow; i++) {
        const pairAddr = await client.readContract({
          address: FACTORY_ADDRESS,
          abi: FACTORY_ABI,
          functionName: 'allPairs',
          args: [i],
        }) as Address;

        try {
          const [token0, token1] = await Promise.all([
            client.readContract({
              address: pairAddr,
              abi: PAIR_ABI,
              functionName: 'token0',
            }),
            client.readContract({
              address: pairAddr,
              abi: PAIR_ABI,
              functionName: 'token1',
            }),
          ]);

          console.log(`${Number(i) + 1}. ${pairAddr}`);
          console.log(`   token0: ${token0}`);
          console.log(`   token1: ${token1}`);
        } catch {
          console.log(`${Number(i) + 1}. ${pairAddr} (could not read tokens)`);
        }
      }
    }
  } catch (error: any) {
    console.log('❌ Could not get pair count:', error.message);
  }
}

findPairs().catch(console.error);
