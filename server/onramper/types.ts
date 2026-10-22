// Shapes from https://docs.onramper.com/reference/get_quotes-fiat-crypto
// and https://docs.onramper.com/reference/post_checkout-v2-intent

export interface QuoteError {
  type: string;
  errorId: number;
  message: string;
}

export interface OnramperQuote {
  ramp: string;
  paymentMethod: string;
  rate?: number;
  networkFee?: number;
  transactionFee?: number;
  payout?: number;
  quoteId?: string;
  recommendations?: string[];
  errors?: QuoteError[];
}

export interface QuoteQuery {
  fiat: string;
  crypto: string;
  amount: number;
  paymentMethod?: string;
  country?: string;
}

export interface CheckoutIntentBody {
  onramp: string;
  source: string;
  destination: string;
  amount: number;
  type: 'buy';
  paymentMethod: string;
  network: string;
  wallet: { address: string };
  endUserIpHash: string;
  platform: 'web';
  partnerContext: string;
}

export interface CheckoutIntentResponse {
  redirectUrl: string;
  sessionId: string;
  resumeToken: string;
}
