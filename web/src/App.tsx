import { useEffect, useState } from 'react';
import { QuotesPanel } from './components/QuotesPanel';
import { WebhooksPanel } from './components/WebhooksPanel';
import { api, type Mode } from './lib/api';

type Connection = Mode | 'offline';

const CONNECTION_LABEL: Record<Connection, string> = {
  mock: 'Sample data',
  live: 'Onramper staging',
  offline: 'API unreachable',
};

export function App() {
  const [connection, setConnection] = useState<Connection>();

  useEffect(() => {
    api<{ mode: Mode }>('/api/health').then(
      ({ mode }) => setConnection(mode),
      () => setConnection('offline'),
    );
  }, []);

  return (
    <>
      <header className="appbar">
        <div className="appbar-inner">
          <div className="wordmark">
            <strong>Ramp Radar</strong>
            <span>Onramp routing console</span>
          </div>
          {connection && (
            <span
              className={`env env-${connection}`}
              title={connection === 'mock' ? 'Set ONRAMPER_API_KEY in .env for live quotes' : undefined}
            >
              {CONNECTION_LABEL[connection]}
            </span>
          )}
        </div>
      </header>

      <main className="page">
        <QuotesPanel />
        <WebhooksPanel demoEnabled={connection === 'mock'} />
      </main>

      <footer className="page-foot">
        Built on the <a href="https://docs.onramper.com">Onramper API</a>. Source and design notes in the README.
      </footer>
    </>
  );
}
