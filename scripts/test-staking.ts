/**
 * Test Staking Service
 * Tests fetching staking data from Injective Hub
 */

import { getUserStakingInfo } from '../src/services/staking';

// Test with a known address (you can replace with your own)
const testAddress = '0x7585c1aDaAb42c802D4ABc6Ee530F0B015C20511' as `0x${string}`;

async function testStaking() {
  console.log('Testing Injective Staking Service');
  console.log('==================================\n');
  
  console.log('Test Address (EVM):', testAddress);
  console.log('Fetching staking information...\n');
  
  try {
    const stakingInfo = await getUserStakingInfo(testAddress);
    
    console.log('Staking Information:');
    console.log('-------------------');
    console.log('Total Staked:', stakingInfo.totalStaked, 'INJ');
    console.log('Total Staked (USD):', '$' + stakingInfo.totalStakedUsd);
    console.log('Staking APR:', stakingInfo.stakingApr + '%');
    console.log('Pending Rewards:', stakingInfo.rewards, 'INJ');
    console.log('Rewards (USD):', '$' + stakingInfo.rewardsUsd);
    console.log();
    
    if (stakingInfo.delegations.length > 0) {
      console.log('Delegations:');
      console.log('-----------');
      stakingInfo.delegations.forEach((del, index) => {
        console.log(`${index + 1}. ${del.validatorName}`);
        console.log(`   Amount: ${del.amount} INJ`);
        console.log(`   Validator: ${del.validatorAddress}`);
        console.log();
      });
    } else {
      console.log('No delegations found.');
    }
    
    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

testStaking();
