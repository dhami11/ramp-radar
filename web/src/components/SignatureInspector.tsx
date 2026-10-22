interface Props {
  canonicalString: string;
  headers: Record<string, string>;
}

const PARTS = ['Version', 'Timestamp', 'Nonce', 'Method', 'Path', 'Query', 'Headers', 'Body SHA-256'];

/**
 * Splits the Signature V2 canonical string back into its 8 documented parts.
 * Parts 1–6 are one line each and part 8 is the last line; part 7 has one line
 * per signed header, so it spans whatever is in between.
 */
function splitParts(canonicalString: string): string[][] {
  const lines = canonicalString.split('\n');
  return [...lines.slice(0, 6).map((line) => [line]), lines.slice(6, -1), [lines.at(-1) ?? '']];
}

export function SignatureInspector({ canonicalString, headers }: Props) {
  return (
    <div className="signature">
      <section className="signature-block" aria-labelledby="signed-string">
        <h4 id="signed-string">Signed string</h4>
        <ol className="receipt">
          {splitParts(canonicalString).map((lines, index) => (
            <li key={PARTS[index]}>
              <span className="receipt-n">{index + 1}</span>
              <span className="receipt-label">{PARTS[index]}</span>
              <span className="receipt-value">
                {lines.every((line) => line === '') ? (
                  <em>empty</em>
                ) : (
                  lines.map((line) => <span key={line}>{line}</span>)
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="signature-block" aria-labelledby="sent-headers">
        <h4 id="sent-headers">Sent with headers</h4>
        <dl className="kv">
          {Object.entries(headers).map(([name, value]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="fine">
          Ed25519 signature over the string on the left. The JSON body is canonicalised (RFC 8785) before hashing, and
          those exact bytes are what gets sent.
        </p>
      </section>
    </div>
  );
}
