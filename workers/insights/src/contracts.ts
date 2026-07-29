export const EVENTS = [
  'site_opened',
  'returned',
  'onboarding_started',
  'onboarding_completed',
  'tool_started',
  'tool_completed',
  'game_opened',
  'game_started',
  'game_completed',
  'client_error',
  'feedback_helpful',
  'feedback_not_for_me',
  'feedback_broken',
] as const;

export const SURFACES = [
  'home',
  'wellbeing',
  'onboarding',
  'plan',
  'games',
  'echo_bloom',
  'vibecenter',
  'singularity',
  'neon_circuit',
  'operators_deck',
  'node_hopper',
  'mind_machine',
  'maker',
  'tool',
  'article',
  'feedback',
  'other',
] as const;

export const DEVICES = ['phone', 'tablet', 'desktop', 'unknown'] as const;
export const RETURN_BUCKETS = ['new', 'same_day', '2_7d', '8_30d', '31d_plus', 'none'] as const;
export const REFERRERS = ['direct', 'search', 'social', 'other', 'none'] as const;
export const BUILDS = ['current', 'v1', 'v2', 'unknown'] as const;
export const VARIANTS = ['none', 'control', 'treatment'] as const;
export const DETAILS = [
  'none',
  'quick_action',
  'daily_pick',
  'timer_complete',
  'second_hit',
  'helpful',
  'not_for_me',
  'broken',
] as const;
export const FEEDBACK_CATEGORIES = ['helpful', 'not_for_me', 'broken', 'idea', 'other'] as const;

type JsonRecord = Record<string, unknown>;
type Member<T extends readonly string[]> = T[number];

export interface SignalInput {
  event: Member<typeof EVENTS>;
  surface: Member<typeof SURFACES>;
  device: Member<typeof DEVICES>;
  returnBucket: Member<typeof RETURN_BUCKETS>;
  referrerGroup: Member<typeof REFERRERS>;
  build: Member<typeof BUILDS>;
  variant: Member<typeof VARIANTS>;
  detail: Member<typeof DETAILS>;
  diagnostic: string;
}

export interface FeedbackInput {
  category: Member<typeof FEEDBACK_CATEGORIES>;
  surface: Member<typeof SURFACES>;
  device: Member<typeof DEVICES>;
  note: string;
  diagnostic: string;
  company: string;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function member<T extends readonly string[]>(value: unknown, choices: T, fallback?: T[number]): T[number] {
  if (typeof value === 'string' && choices.includes(value as T[number])) return value as T[number];
  if (fallback !== undefined) return fallback;
  throw new Error('invalid_enum');
}

function diagnostic(value: unknown): string {
  if (value === undefined || value === null || value === '' || value === 'none') return 'none';
  if (typeof value !== 'string' || !/^[a-f0-9]{12,16}$/.test(value)) throw new Error('invalid_diagnostic');
  return value;
}

export function validateSignal(value: unknown): SignalInput {
  if (!isRecord(value)) throw new Error('invalid_body');
  return {
    event: member(value.event, EVENTS),
    surface: member(value.surface, SURFACES, 'other'),
    device: member(value.device, DEVICES, 'unknown'),
    returnBucket: member(value.returnBucket, RETURN_BUCKETS, 'none'),
    referrerGroup: member(value.referrerGroup, REFERRERS, 'none'),
    build: member(value.build, BUILDS, 'current'),
    variant: member(value.variant, VARIANTS, 'none'),
    detail: member(value.detail, DETAILS, 'none'),
    diagnostic: diagnostic(value.diagnostic),
  };
}

export function validateFeedback(value: unknown): FeedbackInput {
  if (!isRecord(value)) throw new Error('invalid_body');
  const note = typeof value.note === 'string'
    ? value.note.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
    : '';
  if (note.length > 700) throw new Error('note_too_long');
  const category = member(value.category, FEEDBACK_CATEGORIES);
  if ((category === 'broken' || category === 'idea' || category === 'other') && note.length < 3) {
    throw new Error('note_required');
  }
  return {
    category,
    surface: member(value.surface, SURFACES, 'other'),
    device: member(value.device, DEVICES, 'unknown'),
    note,
    diagnostic: diagnostic(value.diagnostic),
    company: typeof value.company === 'string' ? value.company.slice(0, 120) : '',
  };
}
