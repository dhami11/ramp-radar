import { useState, type FormEvent } from 'react';
import { useQuotes } from '../hooks/useQuotes';
import type { RankedQuote } from '../lib/api';
import { ASSETS, FIATS } from '../lib/assets';
import { clock, cryptoAmount, money } from '../lib/format';
import { providerName, recommendationLabel } from '../lib/providers';
import { CheckoutPanel } from './CheckoutPanel';

export function QuotesPanel() {
  const [amount, setAmount] = useState(250);
  const [fiat, setFiat] = useState('eur');
  const [asset, setAsset] = useState('btc');
  const [selected, setSelected] = useState<RankedQuote>();
  const { quotes, error, loading, load } = useQuotes({ amount, fiat, asset });

  function search(event: FormEvent) {
    event.preventDefault();
    setSelected(undefined);
    void load({ amount, fiat, asset });
  }

  // Bars share one scale: the widest gap in this result set.
  const widestGap = Math.max(1, ...(quotes?.ranked.map((q) => q.behindBestBps) ?? []));

  return (
    <section className="panel" aria-labelledby="quotes-title">
      <div className="panel-head">
        <div>
          <h2 id="quotes-title">Quotes</h2>
          <p>Every provider Onramper routes to, ranked by the crypto you receive after fees.</p>
        </div>
        <form className="quote-form" onSubmit={search}>
          <div className="field">
            <label htmlFor="amount">You pay</label>
            <div className="field-box">
              <input
                id="amount"
                type="number"
                inputMode="decimal"
                min={1}
                max={50000}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
              <select id="fiat" aria-label="Currency you pay in" value={fiat} onChange={(e) => setFiat(e.target.value)}>
                {FIATS.map((f) => (
                  <option key={f} value={f}>
                    {f.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="asset">You get</label>
            <div className="field-box">
              <select id="asset" value={asset} onChange={(e) => setAsset(e.target.value)}>
                {ASSETS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? 'Fetching…' : 'Get quotes'}
          </button>
        </form>
      </div>

      {error && (
        <p className="notice notice-bad" role="alert">
          {error}
        </p>
      )}

      {quotes && (
        <>
          <div className="table-wrap">
            <table className="quotes" aria-busy={loading}>
              <thead>
                <tr>
                  <th className="col-rank" scope="col">
                    #
                  </th>
                  <th scope="col">Provider</th>
                  <th className="num" scope="col">
                    You receive
                  </th>
                  <th className="num" scope="col">
                    Price after fees
                  </th>
                  <th className="num" scope="col">
                    Fees
                  </th>
                  <th className="col-gap" scope="col">
                    Behind best
                  </th>
                  <th scope="col">
                    <span className="visually-hidden">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {quotes.ranked.map((quote, index) => (
                  <QuoteRow
                    key={quote.ramp}
                    quote={quote}
                    rank={index + 1}
                    fiat={quotes.query.fiat}
                    asset={quotes.query.crypto}
                    widestGap={widestGap}
                    selected={selected?.ramp === quote.ramp}
                    onToggle={() => setSelected(selected?.ramp === quote.ramp ? undefined : quote)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <p className="panel-note">
            {quotes.unavailable.map((u) => (
              <span key={u.ramp}>
                {providerName(u.ramp)} can’t quote this ({u.reason.toLowerCase()}
                {u.errorId ? `, error ${u.errorId}` : ''}).{' '}
              </span>
            ))}
            <span className="muted">
              {quotes.cached ? 'Cached' : 'Updated'} {clock(quotes.fetchedAt)}
            </span>
          </p>

          {selected && (
            <CheckoutPanel
              key={selected.ramp}
              quote={selected}
              amount={quotes.query.amount}
              fiat={quotes.query.fiat}
              asset={quotes.query.crypto}
            />
          )}
        </>
      )}
    </section>
  );
}

interface QuoteRowProps {
  quote: RankedQuote;
  rank: number;
  fiat: string;
  asset: string;
  widestGap: number;
  selected: boolean;
  onToggle: () => void;
}

function QuoteRow({ quote, rank, fiat, asset, widestGap, selected, onToggle }: QuoteRowProps) {
  const isBest = rank === 1;
  const className = [isBest && 'is-best', selected && 'is-selected'].filter(Boolean).join(' ') || undefined;

  return (
    <tr className={className}>
      <td className="col-rank">{rank}</td>
      <td>
        <div className="provider">
          <span>{providerName(quote.ramp)}</span>
          {quote.recommendations.map((tag) => (
            <span key={tag} className="tag">
              {recommendationLabel(tag)}
            </span>
          ))}
        </div>
      </td>
      <td className="num mono strong">{cryptoAmount(quote.payout, asset)}</td>
      <td className="num mono">{money(quote.effectivePrice, fiat)}</td>
      <td className="num mono">{money(quote.networkFee + quote.transactionFee, fiat)}</td>
      <td className="col-gap">
        {isBest ? (
          <span className="best-label">Best</span>
        ) : (
          <span className="gap">
            <span className="gap-track" aria-hidden>
              <span style={{ width: `${(quote.behindBestBps / widestGap) * 100}%` }} />
            </span>
            <span className="mono">{quote.behindBestBps < 1 ? '<1' : Math.round(quote.behindBestBps)} bps</span>
          </span>
        )}
      </td>
      <td className="col-action">
        <button className="btn btn-quiet" aria-pressed={selected} onClick={onToggle}>
          {selected ? 'Close' : 'Checkout'}
        </button>
      </td>
    </tr>
  );
}
