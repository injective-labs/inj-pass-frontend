export type DAppCategory = string;

export interface DApp {
  id: string;
  name: string;
  description: string;
  icon: string;
  categories: DAppCategory[];
  order: number;
  url: string;
  featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
