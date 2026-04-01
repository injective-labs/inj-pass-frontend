/**
 * DApp Directory Configuration
 */

export type DAppCategory = 'all' | 'defi' | 'nft' | 'game' | 'social' | 'dao';

export interface DApp {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: DAppCategory;
  url: string;
  order?: number;
  featured?: boolean;
}

export const DAPPS: DApp[] = [
  {
    id: '9',
    name: 'Omisper',
    description: 'Decentralized Social Platform',
    icon: '/omisper.png',
    category: 'social',
    url: 'https://omisper-front.pages.dev/',
    featured: true
  },
  {
    id: '10',
    name: 'Hash Mahjong',
    description: 'Injective EVM Mini Game',
    icon: '/hashmahjong.png',
    category: 'game',
    url: 'https://hash-mahjong-two.vercel.app/',
    featured: true
  },
  {
    id: '1',
    name: 'Helix',
    description: 'Decentralized Derivatives Trading',
    icon: 'helixapp.com',
    category: 'defi',
    url: 'https://helixapp.com',
    featured: true
  },
  {
    id: '2',
    name: 'Name Service',
    description: '.inj Domain Names',
    icon: 'inj.space.id',
    category: 'defi',
    url: 'https://www.inj.space.id/',
    featured: true
  },
  {
    id: '3',
    name: 'Paradyze',
    description: 'Yield & Structured Products',
    icon: 'paradyze.io',
    category: 'defi',
    url: 'https://www.paradyze.io/'
  },
  {
    id: '4',
    name: 'Talis',
    description: 'NFT Marketplace',
    icon: 'talis.art',
    category: 'nft',
    url: 'https://talis.art'
  },
  {
    id: '5',
    name: 'Rarible',
    description: 'Multichain NFT Marketplace',
    icon: 'rarible.com',
    category: 'nft',
    url: 'https://rarible.com'
  },
  {
    id: '8',
    name: 'n1nj4',
    description: 'NFT Marketplace',
    icon: 'n1nj4.fun',
    category: 'nft',
    url: 'https://www.n1nj4.fun/'
  },
  {
    id: '6',
    name: 'Injective Hub',
    description: 'Governance & Staking',
    icon: 'hub.injective.network',
    category: 'dao',
    url: 'https://hub.injective.network'
  },
  {
    id: '7',
    name: 'Choice',
    description: 'DEX Aggregator & Vaults',
    icon: 'choice.exchange',
    category: 'defi',
    url: 'https://choice.exchange'
  }
];
