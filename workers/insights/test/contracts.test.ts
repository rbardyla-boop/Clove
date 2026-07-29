import { describe, expect, it } from 'vitest';
import { validateFeedback, validateSignal } from '../src/contracts';

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
