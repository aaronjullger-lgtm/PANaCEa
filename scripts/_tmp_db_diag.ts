/**
 * TEMP diagnostic — delete after use.
 * Never logs credentials: prints host/port/sslmode only.
 */
import dns from 'node:dns';
import net from 'node:net';
import { config } from 'dotenv';

config({ override: true });

const rawUrl = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL || '';
const u = new URL(rawUrl);
const host = u.hostname;
const port = Number(u.port || 5432);
const sslmode = u.searchParams.get('sslmode') ?? '(unset)';

console.log('DIAG_URL', JSON.stringify({ protocol: u.protocol, host, port, sslmode, hasPassword: Boolean(u.password) }));

dns.lookup(host, { all: true }, (err, addresses) => {
  console.log('DIAG_DNS', JSON.stringify({ host, err: err?.message ?? null, addresses }));
  if (err) return;

  const families = [...new Set(addresses.map((a) => a.family))];
  console.log('DIAG_FAMILIES', JSON.stringify({ families }));

  const connTest = (addr: string, label: string) =>
    new Promise<void>((resolve) => {
      const start = Date.now();
      const socket = net.connect({ host: addr, port, family: addr.includes(':') ? 6 : 4, timeout: 8000 });
      socket.once('connect', () => {
        console.log('DIAG_TCP', JSON.stringify({ label, ok: true, ms: Date.now() - start }));
        socket.destroy();
        resolve();
      });
      socket.once('timeout', () => {
        console.log('DIAG_TCP', JSON.stringify({ label, ok: false, err: 'timeout', ms: Date.now() - start }));
        socket.destroy();
        resolve();
      });
      socket.once('error', (e: NodeJS.ErrnoException) => {
        console.log('DIAG_TCP', JSON.stringify({ label, ok: false, err: e.code ?? e.message, ms: Date.now() - start }));
        resolve();
      });
    });

  (async () => {
    for (const a of addresses) {
      await connTest(a.address, `family${a.family}-${a.address}`);
    }
  })();
});
