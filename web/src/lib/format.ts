import { assetById } from './assets';

export const money = (value: number, currency: string) =>
  value.toLocaleString(undefined, { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 2 });

export const cryptoAmount = (value: number, asset: string) => {
  const decimals = assetById(asset)?.decimals ?? 6;
  return `${value.toFixed(decimals)} ${asset.toUpperCase()}`;
};

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
