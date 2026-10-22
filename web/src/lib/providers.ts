const PROVIDERS: Record<string, string> = {
  alchemypay: 'Alchemy Pay',
  banxa: 'Banxa',
  coinbase: 'Coinbase',
  guardarian: 'Guardarian',
  mercuryo: 'Mercuryo',
  moonpay: 'MoonPay',
  topper: 'Topper',
  transak: 'Transak',
};

const PAYMENT_METHODS: Record<string, string> = {
  applepay: 'Apple Pay',
  creditcard: 'card',
  googlepay: 'Google Pay',
  sepabanktransfer: 'SEPA transfer',
};

const RECOMMENDATIONS: Record<string, string> = { BestPrice: 'Best price', LowKyc: 'Low KYC' };

const titleCase = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

export const providerName = (id?: string) => (id ? (PROVIDERS[id] ?? titleCase(id)) : '—');
export const paymentMethodName = (id: string) => PAYMENT_METHODS[id] ?? id;
export const recommendationLabel = (tag: string) => RECOMMENDATIONS[tag] ?? tag;
