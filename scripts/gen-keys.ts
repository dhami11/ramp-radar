// Generates an Ed25519 key pair for Onramper Signature V2.
// Keep the private key; send only the public key to Onramper.
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';

const privatePath = 'onramper-signing-key.pem';
const publicPath = 'onramper-signing-key.pub.pem';

if (existsSync(privatePath)) {
  console.error(`${privatePath} already exists; not overwriting it.`);
  process.exit(1);
}

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
writeFileSync(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
writeFileSync(publicPath, publicKey.export({ type: 'spki', format: 'pem' }));

console.log(`Private key: ${privatePath} (set ONRAMPER_SIGNING_KEY_FILE to this path)`);
console.log(`Public key:  ${publicPath} (send this to Onramper)`);
