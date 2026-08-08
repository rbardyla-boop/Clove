import { describe, expect, it } from 'vitest';
import { runResearchExperience } from '../src/evidence';

const enabled = process.env.LIVE_SOURCES === '1';
const NOW = new Date('2026-08-08T12:00:00.000Z');

const populationQuestion = "What was Canada's population in the latest complete annual period?";
const lawQuestion = 'What federal law governs possession of cannabis by young persons in Canada?';
const scienceQuestion = 'Does creatine supplementation affect cognitive performance in healthy adults?';

describe('live evidence extraction contract', () => {
  it.skipIf(!enabled)('retrieves and validates population, law, and science material from official endpoints', async () => {
    const [population, law, science] = await Promise.all([
      runResearchExperience(populationQuestion, { now: NOW }),
      runResearchExperience(lawQuestion, { now: NOW }),
      runResearchExperience(scienceQuestion, { now: NOW }),
    ]);

    expect(population.status).toBe('QUALIFIED');
    expect(population.strongestDatapoint?.value).toBeGreaterThan(0);
    expect(population.strongestDatapoint?.sourceLocation.table).toBe('17100005');
    expect(population.strongestDatapoint?.sourceFragment).toContain('vectorId=');

    expect(law.status).toBe('QUALIFIED');
    expect(law.legal?.officialText).toContain('5 g of dried cannabis');
    expect(law.legal?.interpretationStatus).toBe('bounded_textual_reading');
    expect(law.claims.find((claim) => claim.id === 'cannabis-act-section-8-possession')?.sourceLocation.statuteSection).toBe('8(1)(c)');

    expect(science.status).toBe('RESEARCH_REQUIRED');
    expect(['METADATA_ONLY', 'ABSTRACT_EVIDENCE']).toContain(science.science?.evidenceLevel);
    expect(science.answer.text).toContain('does not establish');
  }, 45_000);
});
