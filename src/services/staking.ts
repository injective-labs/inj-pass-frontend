/**
 * Injective Staking Service
 * Fetches staking data from Injective Hub
 */

import { Address } from 'viem';
import { getInjectiveAddress } from '@injectivelabs/sdk-ts';

// Injective API endpoints
const INJECTIVE_API = 'https://lcd.injective.network';
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

export interface StakingInfo {
  totalStaked: string; // Total INJ staked
  totalStakedUsd: string; // USD value
  stakingApr: string; // Current staking APR (%)
  rewards: string; // Pending rewards
  rewardsUsd: string; // Rewards in USD
  delegations: Delegation[];
}

export interface Delegation {
  validatorAddress: string;
  validatorName: string;
  amount: string; // Amount staked
  rewards: string; // Pending rewards
}

export interface StakingParams {
  bondDenom: string;
  unbondingTime: string;
  maxValidators: number;
  maxEntries: number;
}

/**
 * Get user's staking information
 */
export async function getUserStakingInfo(address: Address): Promise<StakingInfo> {
  try {
    // Convert EVM address to Injective address if needed
    const injAddress = address.startsWith('0x') 
      ? await convertEvmToInjAddress(address)
      : address;

    console.log('[Staking] Fetching staking info for:', injAddress);

    // Fetch delegations and rewards in parallel
    const [delegationsData, rewardsData, aprData, injPrice] = await Promise.all([
      fetchDelegations(injAddress),
      fetchRewards(injAddress),
      fetchStakingApr(),
      fetchInjPrice(),
    ]);

    // Calculate totals
    const totalStaked = delegationsData.reduce(
      (sum, del) => sum + parseFloat(del.amount),
      0
    ).toString();

    const totalRewards = parseFloat(rewardsData);
    const totalStakedUsd = (parseFloat(totalStaked) * injPrice).toFixed(2);
    const rewardsUsd = (totalRewards * injPrice).toFixed(2);

    return {
      totalStaked: parseFloat(totalStaked).toFixed(4),
      totalStakedUsd,
      stakingApr: aprData,
      rewards: totalRewards.toFixed(4),
      rewardsUsd,
      delegations: delegationsData,
    };
  } catch (error) {
    console.error('[Staking] Failed to fetch staking info:', error);
    
    // Return empty data on error
    return {
      totalStaked: '0.0000',
      totalStakedUsd: '0.00',
      stakingApr: '0.00',
      rewards: '0.0000',
      rewardsUsd: '0.00',
      delegations: [],
    };
  }
}

/**
 * Fetch user's delegations
 */
async function fetchDelegations(injAddress: string): Promise<Delegation[]> {
  try {
    const response = await fetch(
      `${INJECTIVE_API}/cosmos/staking/v1beta1/delegations/${injAddress}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch delegations: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.delegation_responses || data.delegation_responses.length === 0) {
      return [];
    }

    // Fetch validator info for each delegation
    const delegations = await Promise.all(
      data.delegation_responses.map(async (del: any) => {
        const validatorInfo = await fetchValidatorInfo(del.delegation.validator_address);
        
        return {
          validatorAddress: del.delegation.validator_address,
          validatorName: validatorInfo.moniker || 'Unknown Validator',
          amount: (parseFloat(del.balance.amount) / 1e18).toFixed(4), // Convert from base units
          rewards: '0', // Will be populated from rewards endpoint
        };
      })
    );

    return delegations;
  } catch (error) {
    console.error('[Staking] Failed to fetch delegations:', error);
    return [];
  }
}

/**
 * Fetch validator information
 */
async function fetchValidatorInfo(validatorAddress: string): Promise<any> {
  try {
    const response = await fetch(
      `${INJECTIVE_API}/cosmos/staking/v1beta1/validators/${validatorAddress}`
    );

    if (!response.ok) {
      return { moniker: 'Unknown' };
    }

    const data = await response.json();
    return data.validator?.description || { moniker: 'Unknown' };
  } catch (error) {
    console.error('[Staking] Failed to fetch validator info:', error);
    return { moniker: 'Unknown' };
  }
}

/**
 * Fetch user's staking rewards
 */
async function fetchRewards(injAddress: string): Promise<string> {
  try {
    const response = await fetch(
      `${INJECTIVE_API}/cosmos/distribution/v1beta1/delegators/${injAddress}/rewards`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch rewards: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.total || data.total.length === 0) {
      return '0';
    }

    // Sum up all INJ rewards
    const injRewards = data.total.find((r: any) => r.denom === 'inj');
    if (!injRewards) {
      return '0';
    }

    return (parseFloat(injRewards.amount) / 1e18).toString();
  } catch (error) {
    console.error('[Staking] Failed to fetch rewards:', error);
    return '0';
  }
}

/**
 * Fetch current staking APR
 */
async function fetchStakingApr(): Promise<string> {
  try {
    // Fetch staking pool and inflation data
    const [poolResponse, inflationResponse] = await Promise.all([
      fetch(`${INJECTIVE_API}/cosmos/staking/v1beta1/pool`),
      fetch(`${INJECTIVE_API}/cosmos/mint/v1beta1/inflation`),
    ]);

    if (!poolResponse.ok || !inflationResponse.ok) {
      throw new Error('Failed to fetch staking parameters');
    }

    const poolData = await poolResponse.json();
    const inflationData = await inflationResponse.json();

    const bondedTokens = parseFloat(poolData.pool.bonded_tokens);
    const totalSupply = 100000000; // INJ total supply (100M)
    const inflation = parseFloat(inflationData.inflation);

    // Calculate APR: (inflation * total_supply) / bonded_tokens * 100
    const apr = (inflation * totalSupply) / bondedTokens * 100;

    return apr.toFixed(2);
  } catch (error) {
    console.error('[Staking] Failed to fetch APR:', error);
    
    // Return approximate average APR if fetch fails
    return '12.50';
  }
}

/**
 * Fetch INJ price from CoinGecko
 */
async function fetchInjPrice(): Promise<number> {
  try {
    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=injective-protocol&vs_currencies=usd`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch INJ price');
    }

    const data = await response.json();
    return data['injective-protocol']?.usd || 25; // Default to ~$25 if not available
  } catch (error) {
    console.error('[Staking] Failed to fetch INJ price:', error);
    return 25; // Fallback price
  }
}

/**
 * Convert EVM address to Injective bech32 address
 */
async function convertEvmToInjAddress(evmAddress: Address): Promise<string> {
  try {
    // If the address already starts with 'inj', it's already in Cosmos format
    if (evmAddress.startsWith('inj')) {
      return evmAddress;
    }
    
    // Convert EVM address (0x...) to Injective address (inj1...)
    const injAddress = getInjectiveAddress(evmAddress);
    console.log('[Staking] Converted address:', evmAddress, '->', injAddress);
    return injAddress;
  } catch (error) {
    console.error('[Staking] Failed to convert address:', error);
    // Fallback: return original address
    return evmAddress;
  }
}

/**
 * Get staking parameters
 */
export async function getStakingParams(): Promise<StakingParams | null> {
  try {
    const response = await fetch(
      `${INJECTIVE_API}/cosmos/staking/v1beta1/params`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch staking params');
    }

    const data = await response.json();
    return data.params;
  } catch (error) {
    console.error('[Staking] Failed to fetch staking params:', error);
    return null;
  }
}
