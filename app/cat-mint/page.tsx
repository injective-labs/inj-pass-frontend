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
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export default function CatMintPage() {
  const { address, privateKey, isUnlocked, isCheckingSession } = useWallet();
  const [collection, setCollection] = useState<CatCollectionInfo | null>(null);
  const [ownerNFTs, setOwnerNFTs] = useState<CatNFT[]>([]);
  const [mintHash, setMintHash] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState('');

  const contractReady = hasCatNFTContractAddress();
  const canMint = Boolean(isUnlocked && privateKey && contractReady && credits > 0);
  const supplyText = collection ? `${collection.totalMinted}/${collection.maxSupply}` : '...';
  const statusText = isCheckingSession ? 'Checking' : isUnlocked ? 'Ready' : 'Locked';
  const ownerNFT = ownerNFTs[0] ?? null;
  const previewImage = ownerNFT?.image || SAMPLE_CAT_IMAGE;

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

    try {
      const result = await mintCatNFT(privateKey);
      setMintHash(result.hash);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mint failed.');
    } finally {
      setMinting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#070709] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-200/80">
              CatNFT
            </div>
            <h1 className="mt-1 truncate text-2xl font-black sm:text-3xl">Scribble Cyber Cat</h1>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Dashboard
          </Link>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04]">
            <div className="grid gap-0 md:grid-cols-[320px_minmax(0,1fr)]">
              <div className="relative aspect-square bg-white md:aspect-auto md:min-h-[520px]">
                <img src={previewImage} alt="Scribble Cyber Cat preview" className="h-full w-full object-contain" />
                <div className="absolute left-4 top-4 rounded-full border border-black/20 bg-black/50 px-3 py-1 text-xs font-semibold backdrop-blur">
                  {ACTIVE_NETWORK.name}
                </div>
              </div>

              <div className="flex min-h-[520px] flex-col p-5 sm:p-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Supply</div>
                    <div className="mt-2 font-mono text-sm font-bold">{loading && !collection ? '...' : supplyText}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Credits</div>
                    <div className="mt-2 font-mono text-sm font-bold">{credits}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Wallet</div>
                    <div className="mt-2 text-sm font-bold">{statusText}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Owned</div>
                    <div className="mt-2 truncate font-mono text-sm font-bold">{ownerNFTs.length}</div>
                  </div>
                </div>

                <div className="mt-6 flex-1">
                  <div className="rounded-[24px] border border-orange-300/20 bg-orange-300/[0.07] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-100/70">
                          Mint pass
                        </div>
                        <div className="mt-2 text-2xl font-black">Cyber Cat</div>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-xs font-semibold ${canMint ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-white/55'}`}>
                        {canMint ? 'Eligible' : 'Blocked'}
                      </div>
                    </div>

                    <div className="mt-5 space-y-3 text-sm text-white/70">
                      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                        <span>Cost</span>
                        <span className="font-bold text-white">1 mint credit</span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                        <span>Metadata</span>
                        <span className="font-bold text-white">IPFS collection</span>
                      </div>
                    </div>

                    <button
                      onClick={handleMint}
                      disabled={!canMint || minting}
                      className="mt-5 w-full rounded-2xl bg-gradient-to-r from-orange-400 to-amber-300 px-5 py-4 text-sm font-black text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {minting ? 'Minting...' : credits > 0 ? 'Mint Cat NFT' : 'No mint credits'}
                    </button>
                  </div>

                  {error && (
                    <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                      {error}
                    </div>
                  )}

                  {!contractReady && (
                    <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
                      Missing CatNFT contract address.
                    </div>
                  )}

                  {mintHash && (
                    <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
                      Mint sent: <span className="font-mono">{shortHash(mintHash)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-xs text-white/45">
                    <span className="font-mono">{address ? shortHash(address) : 'Wallet not connected'}</span>
                  </div>
                  <button
                    onClick={refreshStatus}
                    disabled={loading}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black">Your Cats</h2>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-white/60">
                  {ownerNFTs.length}
                </span>
              </div>
              {ownerNFTs.length > 0 ? (
                <div className="mt-4 grid max-h-[560px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-1">
                  {ownerNFTs.map((nft) => (
                    <div key={nft.tokenId} className="overflow-hidden rounded-[22px] border border-white/10 bg-black/30">
                      <div className="aspect-square bg-black/40">
                        {nft.image ? (
                          <img src={nft.image} alt={nft.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-white/35">No image</div>
                        )}
                      </div>
                      <div className="space-y-2 p-4">
                        <div className="truncate font-black">{nft.name}</div>
                        <div className="font-mono text-sm text-white/55">#{nft.tokenId}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-[22px] border border-dashed border-white/10 bg-black/20 p-5 text-sm text-white/55">
                  Your owned CatNFTs will appear here after mint.
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-lg font-black">State</h2>
              <div className="mt-4 space-y-3 text-sm text-white/65">
                <div className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                  <span>Contract</span>
                  <span className="font-semibold text-white">{contractReady ? 'Ready' : 'Missing'}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                  <span>Session</span>
                  <span className="font-semibold text-white">{statusText}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                  <span>Eligibility</span>
                  <span className="font-semibold text-white">{canMint ? 'Can mint' : 'Needs credit'}</span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
