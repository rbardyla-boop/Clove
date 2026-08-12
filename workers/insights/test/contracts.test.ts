import { describe, expect, it } from 'vitest';
import { validateFeedback, validateSignal } from '../src/contracts';

const RESEARCH_EVENTS = [
  'research_opened',
  'research_submitted',
  'research_completed',
  'research_insufficient',
  'source_inspected',
  'challenge_opened',
  'research_exported',
] as const;

const MISSION_EVENTS = [
  'mission_viewed',
  'mission_class_selected',
  'mission_committed',
  'mission_exit_prompt_seen',
  'mission_returned',
  'mission_done',
  'mission_partly_done',
  'mission_failed',
  'mission_not_started',
  'mission_debrief_completed',
  'mission_helped_other_yes',
  'mission_helped_other_no',
  'mission_helped_other_unsure',
  'mission_retry_selected',
  'mission_smaller_selected',
  'mission_help_requested',
  'mission_abandoned_reasoned',
] as const;

const researchSignal = (event: typeof RESEARCH_EVENTS[number]) => ({
  event,
  surface: 'research',
  device: 'desktop',
  returnBucket: 'new',
  referrerGroup: 'direct',
  build: 'current',
  variant: 'none',
  detail: 'none',
  diagnostic: 'none',
});

const missionSignal = (event: typeof MISSION_EVENTS[number], detail = 'fix') => ({
  event,
  surface: 'mission',
  device: 'phone',
  returnBucket: 'same_day',
  referrerGroup: 'direct',
  build: 'v2',
  variant: 'none',
  detail,
  diagnostic: 'none',
});

describe('privacy contract', () => {
  it('accepts only coarse, enumerated aggregate dimensions', () => {
    expect(validateSignal({
      event: 'game_completed',
      surface: 'echo_bloom',
      device: 'phone',
      returnBucket: '2_7d',
      referrerGroup: 'direct',
      build: 'v2',
      variant: 'none',
      detail: 'timer_complete',
      diagnostic: 'none',
    })).toMatchObject({ event: 'game_completed', surface: 'echo_bloom' });
    expect(() => validateSignal({ event: 'page_view', surface: '/private/url?name=x' })).toThrow();
  });

  it('accepts exactly the seven coarse research events', () => {
    for (const event of RESEARCH_EVENTS) {
      expect(validateSignal(researchSignal(event))).toMatchObject({ event, surface: 'research' });
    }
  });

  it('accepts the bounded Mission 001 event vocabulary and mission classes', () => {
    for (const event of MISSION_EVENTS) {
      expect(validateSignal(missionSignal(event))).toMatchObject({ event, surface: 'mission', detail: 'fix' });
    }
    for (const detail of ['fix', 'serve', 'learn', 'build']) {
      expect(validateSignal(missionSignal('mission_class_selected', detail))).toMatchObject({ detail });
    }
  });

  it('rejects mission content and non-enumerated mission dimensions', () => {
    expect(() => validateSignal({ ...missionSignal('mission_done'), detail: 'repair my neighbour car at 14 King St' })).toThrow();
    const validated = validateSignal({
      ...missionSignal('mission_debrief_completed', 'serve'),
      missionText: 'Help John Smith move from 14 King Street',
      evidence: 'Private before/after description',
      photo: 'data:image/jpeg;base64,private',
      exactTimestamp: '2026-08-12T11:17:00.000Z',
      latitude: 46.2382,
      longitude: -63.1311,
      identifier: 'user-123',
    });
    expect(Object.keys(validated).sort()).toEqual([
      'build', 'device', 'diagnostic', 'detail', 'event', 'referrerGroup',
      'returnBucket', 'surface', 'variant',
    ].sort());
    expect(validated).not.toHaveProperty('missionText');
    expect(validated).not.toHaveProperty('evidence');
    expect(validated).not.toHaveProperty('photo');
    expect(validated).not.toHaveProperty('latitude');
  });

  it('rejects unknown research events and strips research content fields', () => {
    expect(() => validateSignal({ ...researchSignal('research_completed'), event: 'research_topic_viewed' })).toThrow();
    const validated = validateSignal({
      ...researchSignal('research_completed'),
      question: 'What is the private research topic?',
      answer: 'A private answer that must never be stored.',
      sourceUrl: 'https://private.example/source',
      claim: 'A private claim that must never be stored.',
      topic: 'private-topic',
      obsidianContents: '# Private export',
      identifier: 'user-123',
      ip: '192.0.2.1',
      fullReferrer: 'https://private.example/full-referrer',
    });
    expect(Object.keys(validated).sort()).toEqual([
      'build', 'device', 'diagnostic', 'detail', 'event', 'referrerGroup',
      'returnBucket', 'surface', 'variant',
    ].sort());
    expect(validated).not.toHaveProperty('question');
    expect(validated).not.toHaveProperty('answer');
    expect(validated).not.toHaveProperty('sourceUrl');
    expect(validated).not.toHaveProperty('claim');
    expect(validated).not.toHaveProperty('identifier');
  });

  it('rejects raw error messages and accepts only short hashes', () => {
    expect(() => validateSignal({ event: 'client_error', diagnostic: 'my full stack trace' })).toThrow('invalid_diagnostic');
    expect(validateSignal({ event: 'client_error', diagnostic: 'a1b2c3d4e5f6' }).diagnostic).toBe('a1b2c3d4e5f6');
  });

  it('requires useful notes for broken, idea, and other feedback', () => {
    expect(() => validateFeedback({ category: 'broken', note: '' })).toThrow('note_required');
    expect(validateFeedback({ category: 'helpful', note: '', surface: 'tool' }).note).toBe('');
  });

  it('strips control characters and caps feedback at 700 characters', () => {
    expect(validateFeedback({ category: 'idea', note: 'add\u0000 this', surface: 'home' }).note).toBe('add this');
    expect(() => validateFeedback({ category: 'idea', note: 'x'.repeat(701) })).toThrow('note_too_long');
  });
});
