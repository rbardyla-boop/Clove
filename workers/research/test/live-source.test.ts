import { describe, expect, it } from 'vitest';
import { CANADA_NUCLEAR_QUESTION, investigate } from '../src/research';

describe('live public-source contract', () => {
  it.skipIf(process.env.LIVE_SOURCES !== '1')('parses the current official source pages', async () => {
    const result = await investigate(CANADA_NUCLEAR_QUESTION);
    expect(result.status).toBe('supported');
    expect(result.strongestDatapoint.value).toBeGreaterThan(12);
    expect(result.strongestDatapoint.value).toBeLessThan(14);
    expect(result.independentSourceCheck.status).toBe('pass');
    expect(result.contradictions.some((item) => item.status === 'period_mismatch')).toBe(true);
  }, 15_000);
});
