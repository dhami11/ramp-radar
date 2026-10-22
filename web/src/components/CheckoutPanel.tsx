import { useState, type FormEvent } from 'react';
import { api, type CheckoutRequest, type CheckoutResponse, type RankedQuote } from '../lib/api';
import { assetById } from '../lib/assets';
import { money } from '../lib/format';
import { paymentMethodName, providerName } from '../lib/providers';
import { SignatureInspector } from './SignatureInspector';

// Well-known public addresses, so the form is usable without typing.
const SAMPLE_WALLETS: Record<string, string> = {
  bitcoin: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  ethereum: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  solana: '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
};

interface Props {
  quote: RankedQuote;
  amount: number;
  fiat: string;
  asset: string;
}

export function CheckoutPanel({ quote, amount, fiat, asset }: Props) {
  const network = assetById(asset)?.network ?? asset;
  const [wallet, setWallet] = useState(SAMPLE_WALLETS[network] ?? '');
  const [result, setResult] = useState<CheckoutResponse>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const request: CheckoutRequest = {
      onramp: quote.ramp,
      fiat,
      crypto: asset,
      amount,
      paymentMethod: quote.paymentMethod,
      network,
      walletAddress: wallet,
    };
    try {
      setResult(await api<CheckoutResponse>('/api/checkout', request));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="checkout">
      <div className="checkout-head">
        <h3>Checkout with {providerName(quote.ramp)}</h3>
        <p>
          {money(amount, fiat)} to {asset.toUpperCase()} on the {network} network, paid by{' '}
          {paymentMethodName(quote.paymentMethod)}.
        </p>
      </div>

      <form className="checkout-form" onSubmit={submit}>
        <div className="field field-grow">
          <label htmlFor="wallet">Receiving wallet</label>
          <div className="field-box">
            <input
              id="wallet"
              className="mono"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Signing…' : 'Create checkout session'}
        </button>
      </form>

      {error && (
        <p className="notice notice-bad" role="alert">
          {error}
        </p>
      )}

      {result && (
        <>
          <p className="notice notice-good" role="status">
            Session <span className="mono">{result.session.sessionId.slice(0, 8)}</span> is ready.{' '}
            {result.mode === 'live' ? (
              <a href={result.session.redirectUrl} target="_blank" rel="noreferrer">
                Open checkout
              </a>
            ) : (
              <span className="muted">Sample session, so there is no checkout page to open.</span>
            )}
          </p>
          <SignatureInspector canonicalString={result.signature.canonicalString} headers={result.signature.headers} />
        </>
      )}
    </div>
  );
}
