/**
 * Price service for fetching real-time cryptocurrency prices
 */

export interface TokenPrice {
  usd: number;
  usd24hChange?: number;
  lastUpdated?: number;
}

// Cache to avoid too many requests
const priceCache: Map<string, { price: TokenPrice; timestamp: number }> = new Map();
const CACHE_DURATION = 60000; // 1 minute

/**
 * Fetch INJ price from CoinGecko API
 */
export async function getInjPrice(): Promise<number> {
  const cacheKey = 'inj-usd';
  const cached = priceCache.get(cacheKey);
  
  // Return cached price if it's still fresh
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.price.usd;
  }

  try {
    // Using CoinGecko public API (no API key required)
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=injective-protocol&vs_currencies=usd&include_24hr_change=true',
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch price: ${response.status}`);
    }

    const data = await response.json();
    const price = data['injective-protocol']?.usd;

    if (!price) {
      throw new Error('Price data not available');
    }

    // Cache the result
    priceCache.set(cacheKey, {
      price: {
        usd: price,
        usd24hChange: data['injective-protocol']?.usd_24h_change,
        lastUpdated: Date.now(),
      },
      timestamp: Date.now(),
    });

    return price;
  } catch (error) {
    console.error('Failed to fetch INJ price:', error);
    
    // Return cached price if available, even if expired
    if (cached) {
      console.warn('Using expired cached price');
      return cached.price.usd;
    }
    
    // Fallback to a reasonable default (current approximate INJ price)
    console.warn('Using fallback price');
    return 25; // Fallback price
  }
}

/**
 * Get token price with detailed information
 */
export async function getTokenPrice(tokenId: string = 'injective-protocol'): Promise<TokenPrice> {
  const cacheKey = `${tokenId}-usd`;
  const cached = priceCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.price;
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd&include_24hr_change=true`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch price: ${response.status}`);
    }

    const data = await response.json();
    const tokenData = data[tokenId];

    if (!tokenData) {
      throw new Error('Token price data not available');
    }

    const priceData: TokenPrice = {
      usd: tokenData.usd,
      usd24hChange: tokenData.usd_24h_change,
      lastUpdated: Date.now(),
    };

    priceCache.set(cacheKey, {
      price: priceData,
      timestamp: Date.now(),
    });

    return priceData;
  } catch (error) {
    console.error(`Failed to fetch ${tokenId} price:`, error);
    
    if (cached) {
      return cached.price;
    }
    
    return {
      usd: 25,
      lastUpdated: Date.now(),
    };
  }
}

/**
 * Clear the price cache
 */
export function clearPriceCache(): void {
  priceCache.clear();
}
