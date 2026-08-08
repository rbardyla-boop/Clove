import { describe, expect, it } from 'vitest';
import { discoverQuestion } from '../src/discovery/registry';

const POPULATION_QUESTION = "What was Canada's population in the latest complete annual period?";
const LAW_QUESTION = 'What federal law governs possession of cannabis by young persons in Canada?';
const SCIENCE_QUESTION = 'Does creatine supplementation affect cognitive performance in healthy adults?';

describe('live discovery adapter contract', () => {
  it.skipIf(process.env.LIVE_SOURCES !== '1')('discovers all three bounded evidence classes from official systems', async () => {
    const [statcan, justice, crossref] = await Promise.all([
      discoverQuestion(POPULATION_QUESTION),
      discoverQuestion(LAW_QUESTION),
      discoverQuestion(SCIENCE_QUESTION),
    ]);

    expect(['DISCOVERY_COMPLETE', 'DISCOVERY_PARTIAL']).toContain(statcan.status);
    expect(statcan.candidates.length).toBeGreaterThan(0);
    expect(statcan.candidates.some((candidate) => candidate.identifiers.geography === 'Canada')).toBe(true);
    expect(statcan.candidates.some((candidate) => candidate.measurementPeriod?.includes('Annual'))).toBe(true);
    expect(statcan.candidates.every((candidate) => candidate.provenance.endpoint.includes('statcan.gc.ca'))).toBe(true);

    expect(['DISCOVERY_COMPLETE', 'DISCOVERY_PARTIAL']).toContain(justice.status);
    const act = justice.candidates.find((candidate) => candidate.title === 'Cannabis Act');
    expect(act).toBeDefined();
    expect(act?.authority).toBe('primary');
    expect(act?.currentTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(act?.identifiers.instrumentType).toBe('act');
    expect(act?.identifiers.xmlUrl).toContain('/eng/XML/');
    expect(justice.candidates.some((candidate) => candidate.identifiers.instrumentType === 'regulation')).toBe(true);

    expect(crossref.status).toBe('RESEARCH_REQUIRED');
    expect(crossref.candidates.length).toBeGreaterThanOrEqual(2);
    expect(new Set(crossref.candidates.map((candidate) => candidate.doi)).size).toBe(crossref.candidates.length);
    expect(crossref.candidates.every((candidate) => candidate.authority === 'metadata')).toBe(true);
    expect(crossref.candidates.every((candidate) => candidate.identifiers.evidenceStatus === 'RESEARCH_REQUIRED')).toBe(true);
  }, 60_000);
});
