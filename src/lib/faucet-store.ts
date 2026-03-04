/**
 * In-process rate-limit store for the faucet.
 *
 * Uses a global singleton so the Map survives Next.js hot-reloads (dev)
 * and stays alive across warm serverless invocations (prod).
 *
 * For a multi-instance deployment, swap the Map for Redis / Upstash KV.
 *
 * Key schema: `${address.toLowerCase()}::${yyyy-mm-dd}`
 *
 * @author 0xAlexWu <jsxj81@163.com>
 */

interface ClaimRecord {
  companion: string | null;
  claimedAt: string;
}

const g = globalThis as unknown as {
  __faucetClaims: Map<string, ClaimRecord>;
};

if (!g.__faucetClaims) {
  g.__faucetClaims = new Map<string, ClaimRecord>();
}

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

function key(address: string): string {
  return `${address.toLowerCase()}::${todayUTC()}`;
}

export function hasClaimedToday(address: string): boolean {
  return g.__faucetClaims.has(key(address));
}

export function recordClaim(address: string, companion: string | null): void {
  g.__faucetClaims.set(key(address), {
    companion,
    claimedAt: new Date().toISOString(),
  });
}
