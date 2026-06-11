'use client';
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { ACTIVE_NETWORK } from '@/config/network';
import {
  getCatCollectionInfo,
  getCatMintCredits,
  getCatNFTsForOwner,
  hasCatNFTContractAddress,
  mintCatNFT,
  type CatCollectionInfo,
  type CatNFT,
} from '@/services/catnft';

const SAMPLE_CAT_IMAGE =
  'https://sapphire-occupational-hornet-805.mypinata.cloud/ipfs/bafybeihdj7vo5dbapkq6lnudgn5iq4trs7g4khdlm23nzce76kth2x3ivu/001.png';

function shortHash(value: string) {
  if (!value) return '';
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function CatGalleryCard({ nft }: { nft: CatNFT }) {
  const traitCount = nft.metadata?.attributes?.length ?? 0;
  return (
    <div className="group relative overflow-hidden rounded-[22px] border border-white/10 bg-black/30 transition-all duration-300 hover:border-cyan-300/40 hover:shadow-[0_0_26px_-6px_rgba(34,211,238,0.55)]">
      <div className="relative aspect-square overflow-hidden bg-black/40">
        {nft.image ? (
          <img
            src={nft.image}
            alt={nft.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/35">No image</div>
        )}
        {traitCount > 0 && (
          <span className="absolute right-2.5 top-2.5 rounded-full border border-cyan-300/30 bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-cyan-100 backdrop-blur">
            {traitCount} traits
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="truncate text-sm font-bold">{nft.name}</span>
          <span className="font-mono text-xs text-cyan-200/80">#{nft.tokenId}</span>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-[22px] border border-white/10 bg-black/30">
      <div className="relative aspect-square overflow-hidden bg-white/[0.04]">
        <span className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent [animation:shimmer_1.6s_linear_infinite]" />
      </div>
    </div>
  );
}

export default function CatMintPage() {
  const { address, privateKey, isUnlocked, isCheckingSession } = useWallet();
  const [collection, setCollection] = useState<CatCollectionInfo | null>(null);
  const [ownerNFTs, setOwnerNFTs] = useState<CatNFT[]>([]);
  const [mintHash, setMintHash] = useState<string | null>(null);
  const [mintedTokenId, setMintedTokenId] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState('');

  const contractReady = hasCatNFTContractAddress();
  const canMint = Boolean(isUnlocked && privateKey && contractReady && credits > 0);
  const ownerNFT = ownerNFTs[0] ?? null;
  const previewImage = ownerNFT?.image || SAMPLE_CAT_IMAGE;
  const supplyPct =
    collection && collection.maxSupply > 0
      ? Math.min(100, (collection.totalMinted / collection.maxSupply) * 100)
      : 0;
  const initialLoading = loading && !collection;
  const galleryLoading = loading && ownerNFTs.length === 0;
  const explorerTxUrl = mintHash ? `${ACTIVE_NETWORK.explorerUrl}/tx/${mintHash}` : null;

  // The single primary action encodes every gate — no separate status panel needed.
  const mintLabel = !contractReady
    ? 'Unavailable'
    : isCheckingSession
      ? 'Checking session…'
      : !isUnlocked
        ? 'Unlock wallet to mint'
        : credits <= 0
          ? 'No mint credits'
          : 'Mint Cat NFT';

  const refreshStatus = async () => {
    if (!address || !contractReady) {
      setOwnerNFTs([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [collectionInfo, nfts, mintCredits] = await Promise.all([
        getCatCollectionInfo(),
        getCatNFTsForOwner(address as `0x${string}`),
        getCatMintCredits(),
      ]);

      setCollection(collectionInfo);
      setOwnerNFTs(nfts);
      setCredits(mintCredits.mintCreditsRemaining);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CatNFT state.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, contractReady]);

  const handleMint = async () => {
    if (!privateKey) {
      setError('Unlock your wallet first.');
      return;
    }

    setMinting(true);
    setError('');
    setMintHash(null);
    setMintedTokenId(null);

    try {
      const result = await mintCatNFT(privateKey);
      setMintHash(result.hash);
      setMintedTokenId(result.tokenId);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mint failed.');
    } finally {
      setMinting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070709] text-white">
      {/* Cyber-neon atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 12% 6%, rgba(251,146,60,0.16), transparent 60%), radial-gradient(55% 50% at 88% 92%, rgba(34,211,238,0.14), transparent 60%)',
        }}
      />

      <div className="animate-fade-in relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
            CatNFT
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-300/30 hover:bg-white/10"
          >
            Dashboard
          </Link>
        </header>

        {/* ── Primary mint module: big artwork + focused rail ── */}
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04]">
          <div className="grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            {/* Hero artwork */}
            <div className="relative flex min-h-[380px] items-center justify-center overflow-hidden bg-gradient-to-b from-[#0c0c12] to-[#070709] p-6 md:min-h-[560px]">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 [animation:catNeonGlow_6.5s_ease-in-out_infinite]"
                style={{
                  background:
                    'radial-gradient(circle at 32% 30%, rgba(251,146,60,0.45), transparent 55%), radial-gradient(circle at 70% 74%, rgba(34,211,238,0.4), transparent 55%)',
                  filter: 'blur(46px)',
                }}
              />
              <div className="relative aspect-square w-full max-w-[360px] overflow-hidden rounded-[26px] border border-white/15 bg-white shadow-[0_0_52px_-10px_rgba(34,211,238,0.55)] [animation:catFloat_7s_ease-in-out_infinite]">
                <img
                  src={previewImage}
                  alt="Scribble Cyber Cat preview"
                  className="h-full w-full object-contain"
                />
                <div className="absolute left-3 top-3 rounded-full border border-cyan-300/30 bg-black/55 px-3 py-1 text-xs font-semibold text-cyan-100 backdrop-blur">
                  {ACTIVE_NETWORK.name}
                </div>
                {ownerNFT ? (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-3">
                    <div className="truncate text-sm font-black text-white">{ownerNFT.name}</div>
                    <div className="font-mono text-xs text-cyan-200/85">#{ownerNFT.tokenId}</div>
                  </div>
                ) : (
                  <div className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
                    Preview
                  </div>
                )}
              </div>
            </div>

            {/* Mint rail — one clean vertical flow */}
            <div className="flex flex-col gap-7 border-t border-white/10 p-6 sm:p-8 md:border-l md:border-t-0">
              <div>
                <h1 className="bg-gradient-to-r from-orange-200 via-amber-100 to-cyan-200 bg-clip-text text-2xl font-black text-transparent sm:text-3xl">
                  Scribble Cyber Cat
                </h1>
                <p className="mt-1.5 text-sm text-white/45">
                  Generative cats on {ACTIVE_NETWORK.name}.
                </p>
              </div>

              {/* Supply */}
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/70">
                    Minted
                  </span>
                  <span className="font-mono text-sm font-bold text-amber-200">
                    {initialLoading ? '··%' : `${supplyPct.toFixed(0)}%`}
                  </span>
                </div>
                <div className="mt-1.5 font-mono text-2xl font-black tracking-tight">
                  {initialLoading || !collection
                    ? '··· / ···'
                    : `${collection.totalMinted.toLocaleString()} / ${collection.maxSupply.toLocaleString()}`}
                </div>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full border border-white/5 bg-black/50">
                  <div
                    className="relative h-full rounded-full bg-gradient-to-r from-orange-400 via-amber-300 to-cyan-300 transition-all duration-1000"
                    style={{ width: `${supplyPct}%` }}
                  >
                    {supplyPct > 0 && (
                      <span className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent [animation:shimmer_2.2s_linear_infinite]" />
                    )}
                  </div>
                </div>
              </div>

              {/* Price */}
              <div className="flex items-end justify-between border-t border-white/10 pt-6">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                    Price
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black">1</span>
                    <span className="text-sm text-white/55">mint credit</span>
                  </div>
                </div>
                <div className="text-right text-xs text-white/45">
                  You have <span className="font-mono font-bold text-white/80">{credits}</span>{' '}
                  credit{credits === 1 ? '' : 's'}
                </div>
              </div>

              {/* Primary action */}
              <button
                onClick={handleMint}
                disabled={!canMint || minting}
                className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-orange-400 to-amber-300 px-5 py-4 text-sm font-black text-black transition hover:shadow-[0_0_32px_-2px_rgba(34,211,238,0.7)] active:scale-[0.98] disabled:cursor-not-allowed disabled:from-white/[0.08] disabled:to-white/[0.08] disabled:text-white/40 disabled:shadow-none"
              >
                {minting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    Minting…
                  </span>
                ) : (
                  mintLabel
                )}
              </button>

              {/* Result / error — only ever one at a time */}
              {mintHash && (
                <div className="animate-fade-in rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-200">
                      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                        <path
                          d="M5 13l4 4L19 7"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-emerald-100">
                        Minted!
                        {mintedTokenId && <span className="font-mono"> #{mintedTokenId}</span>}
                      </div>
                      <div className="truncate font-mono text-xs text-emerald-200/70">
                        {shortHash(mintHash)}
                      </div>
                    </div>
                    {explorerTxUrl && (
                      <a
                        href={explorerTxUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-100 transition hover:bg-emerald-400/20"
                      >
                        Explorer →
                      </a>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              )}

              {/* De-emphasised footer */}
              <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-5 text-xs text-white/40">
                <span className="font-mono">
                  {address ? shortHash(address) : 'Wallet not connected'}
                </span>
                <button
                  onClick={refreshStatus}
                  disabled={loading}
                  className="font-semibold text-white/55 transition hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Your collection — always present as the entry point to owned NFTs ── */}
        <section className="mt-6">
          <div className="mb-4 flex items-center gap-2.5">
            <h2 className="text-lg font-black">Your Cats</h2>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/15 px-2.5 py-0.5 text-xs font-bold text-cyan-100">
              {ownerNFTs.length}
            </span>
          </div>
          {galleryLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : ownerNFTs.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {ownerNFTs.map((nft) => (
                <CatGalleryCard key={nft.tokenId} nft={nft} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-[24px] border border-dashed border-white/12 bg-white/[0.02] px-6 py-12 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/30 text-xl">
                🐾
              </span>
              <p className="text-sm font-semibold text-white/70">
                {isUnlocked ? 'No cats yet' : 'Unlock your wallet to see your cats'}
              </p>
              <p className="text-xs text-white/40">
                {isUnlocked
                  ? 'Mint above and your collection will show up here.'
                  : 'Owned CatNFTs from this wallet appear here once unlocked.'}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
