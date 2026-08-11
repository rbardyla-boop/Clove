import { describe, expect, it } from 'vitest';
import { runResearchExperience } from '../src/evidence';

const tradeQuestion = 'how many cubic metres of softwood did Canada export to the US in 2025';

describe('live Canadian trade source replay', () => {
  it.skipIf(process.env.LIVE_SOURCES !== '1')('retrieves the GAC annual result and Statistics Canada context', async () => {
    const result = await runResearchExperience(tradeQuestion, { now: new Date('2026-08-11T12:00:00.000Z') });

    expect(result.status).toBe('QUALIFIED');
    expect(result.recipeId).toBe('canadian_trade_statistic');
    expect(result.claims.find((claim) => claim.id === 'gac-softwood-2025-board-feet')?.value).toBe(10631142309);
    expect(result.claims.find((claim) => claim.id === 'gac-softwood-2025-cubic-metres')?.value).toBe(25086702);
    expect(result.claims.find((claim) => claim.id === 'statcan-lumber-context-2025')?.value).toBe(28275.8);
    expect(result.challenge.status).toBe('executed');
  });
});
