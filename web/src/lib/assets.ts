export const FIATS = ['eur', 'usd', 'gbp'] as const;

/** Display precision follows each asset's convention: satoshis for BTC, cents for stablecoins. */
export const ASSETS = [
  { id: 'btc', network: 'bitcoin', decimals: 8 },
  { id: 'eth', network: 'ethereum', decimals: 6 },
  { id: 'sol', network: 'solana', decimals: 4 },
  { id: 'usdc', network: 'ethereum', decimals: 2 },
] as const;

export const assetById = (id: string) => ASSETS.find((a) => a.id === id);
