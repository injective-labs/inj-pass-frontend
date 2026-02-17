/**
 * NFT Detail Modal Component
 * 
 * Displays detailed information about a selected NFT in a vertical card format.
 */

'use client';

import { NFT } from '@/services/nft';
import Image from 'next/image';
import { useState } from 'react';

interface NFTDetailModalProps {
  nft: NFT;
  onClose: () => void;
}

export default function NFTDetailModal({ nft, onClose }: NFTDetailModalProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div 
        className="bg-black border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{nft.name}</h3>
            <p className="text-sm text-gray-400">{nft.collection}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 transition-all"
          >
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {/* NFT Image */}
          <div className="relative w-full aspect-square bg-white/5">
            {nft.image && !imageError ? (
              <Image
                src={nft.image}
                alt={nft.name}
                fill
                className="object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" strokeWidth={2} />
                      <path d="M9 3v18M3 9h18" strokeWidth={2} strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500">No image available</p>
                </div>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="p-6 space-y-6">
            {/* Description */}
            {nft.description && (
              <div>
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Description</h4>
                <p className="text-white text-sm leading-relaxed">{nft.description}</p>
              </div>
            )}

            {/* Token Info */}
            <div>
              <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Token Info</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <span className="text-sm text-gray-400">Token ID</span>
                  <span className="text-sm font-mono text-white">#{nft.tokenId}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <span className="text-sm text-gray-400">Collection</span>
                  <span className="text-sm font-semibold text-white">{nft.collection}</span>
                </div>
                <div className="flex flex-col p-3 bg-white/5 rounded-xl">
                  <span className="text-sm text-gray-400 mb-2">Contract Address</span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-white">
                      {nft.contractAddress.slice(0, 10)}...{nft.contractAddress.slice(-8)}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(nft.contractAddress);
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 16 16">
                        <rect width="11" height="11" x="4" y="4" rx="1" ry="1" strokeWidth="1.5" />
                        <path d="M2 10c-0.8 0-1.5-0.7-1.5-1.5V2c0-0.8 0.7-1.5 1.5-1.5h8.5c0.8 0 1.5 0.7 1.5 1.5" strokeWidth="1.5" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Attributes/Traits */}
            {nft.metadata?.attributes && nft.metadata.attributes.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Attributes</h4>
                <div className="grid grid-cols-2 gap-3">
                  {nft.metadata.attributes.map((attr, index) => (
                    <div 
                      key={index}
                      className="p-3 bg-white/5 rounded-xl border border-white/5"
                    >
                      <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">
                        {attr.trait_type}
                      </div>
                      <div className="text-sm font-semibold text-white">
                        {attr.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* External Link */}
            {nft.metadata?.external_url && (
              <a
                href={nft.metadata.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-white text-black font-bold hover:bg-gray-100 transition-all"
              >
                <span>View on External Site</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}

            {/* View on Explorer */}
            <a
              href={`https://blockscout.injective.network/token/${nft.contractAddress}/instance/${nft.tokenId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all"
            >
              <span>View on Blockscout</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
