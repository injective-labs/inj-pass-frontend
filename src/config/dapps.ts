export type DAppCategory = string;
export type DAppPrimaryCategory = DAppCategory;

export type DAppToolId =
  | 'get_wallet_info'
  | 'get_balance'
  | 'get_swap_quote'
  | 'execute_swap'
  | 'send_token'
  | 'get_tx_history'
  | 'play_hash_mahjong'
  | 'play_hash_mahjong_multi';

export interface DApp {
  id: string;
  name: string;
  description: string;
  icon: string;
  categories: DAppCategory[];
  primaryCategory?: DAppPrimaryCategory;
  toolIds?: DAppToolId[];
  aiDriven?: boolean;
  order: number;
  url: string;
  featured?: boolean;
  aiPrompt?: string;
  aiPromptVersion?: string;
  mentionPrompt?: string;
  mentionLabel?: string;
  mentionThemeKey?: string;
  createdAt?: string;
  updatedAt?: string;
}
