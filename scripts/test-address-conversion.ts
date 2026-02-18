/**
 * Test EVM to Cosmos address conversion using Injective SDK
 */

import { getInjectiveAddress, getEthereumAddress } from '@injectivelabs/sdk-ts';

// Test case from user's example
const testEvmAddress = '0x7585c1aDaAb42c802D4ABc6Ee530F0B015C20511';
const expectedCosmosAddress = 'inj1wkzurtd2kskgqt22h3hw2v8skq2uypg3fndl7z';

console.log('Testing Injective Address Conversion');
console.log('=====================================\n');

// EVM to Cosmos
console.log('Test 1: EVM to Cosmos');
console.log('Input (EVM):', testEvmAddress);
const convertedCosmos = getInjectiveAddress(testEvmAddress);
console.log('Output (Cosmos):', convertedCosmos);
console.log('Expected:', expectedCosmosAddress);
console.log('Match:', convertedCosmos === expectedCosmosAddress ? '✅' : '❌');
console.log();

// Cosmos to EVM (reverse)
console.log('Test 2: Cosmos to EVM (reverse)');
console.log('Input (Cosmos):', expectedCosmosAddress);
const convertedEvm = getEthereumAddress(expectedCosmosAddress);
console.log('Output (EVM):', convertedEvm);
console.log('Expected:', testEvmAddress);
console.log('Match:', convertedEvm.toLowerCase() === testEvmAddress.toLowerCase() ? '✅' : '❌');
console.log();

console.log('All tests completed!');
