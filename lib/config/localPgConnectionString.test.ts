import { describe, expect, it } from 'vitest';
import { normalizeLocalPgConnectionString } from './localPgConnectionString';

describe('normalizeLocalPgConnectionString', () => {
  it('adds libpq compatibility for local postgres sslmode=require URLs', () => {
    const input = 'postgresql://user:pass@example.test:5432/app?sslmode=require';

    const output = normalizeLocalPgConnectionString(input);
    const url = new URL(output);

    expect(url.searchParams.get('sslmode')).toBe('require');
    expect(url.searchParams.get('uselibpqcompat')).toBe('true');
  });

  it('preserves explicit libpq compatibility choices', () => {
    const input =
      'postgresql://user:pass@example.test:5432/app?sslmode=require&uselibpqcompat=false';

    expect(normalizeLocalPgConnectionString(input)).toBe(input);
  });

  it('leaves verify-full postgres URLs unchanged', () => {
    const input = 'postgresql://user:pass@example.test:5432/app?sslmode=verify-full';

    expect(normalizeLocalPgConnectionString(input)).toBe(input);
  });

  it('leaves non-postgres URLs unchanged', () => {
    const input = 'prisma://accelerate.prisma-data.net/?api_key=secret';

    expect(normalizeLocalPgConnectionString(input)).toBe(input);
  });

  it('leaves malformed URLs unchanged', () => {
    const input = 'not a database url';

    expect(normalizeLocalPgConnectionString(input)).toBe(input);
  });
});
