export type DiscoveryStatus =
  | 'DISCOVERY_COMPLETE'
  | 'DISCOVERY_EMPTY'
  | 'DISCOVERY_PARTIAL'
  | 'SOURCE_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'RECIPE_NOT_FOUND'
  | 'RESEARCH_REQUIRED';

export type DiscoveryAuthority = 'primary' | 'secondary' | 'metadata';

export interface DiscoveryCandidate {
  sourceId: string;
  sourceClass: string;
  title: string;
  url: string;
  authority: DiscoveryAuthority;
  institution?: string;
  publishedAt?: string;
  measurementPeriod?: string;
  currentTo?: string;
  doi?: string;
  identifiers: Record<string, string>;
  discoveryMethod: string;
  queryUsed: string;
  provenance: {
    provider: string;
    retrievedAt: string;
    endpoint: string;
  };
}

export type DiscoveryFetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface DiscoveryContext {
  fetcher?: DiscoveryFetcher;
  now?: Date;
  timeoutMs?: number;
}

export interface IndependenceGroup {
  key: string;
  candidateIds: string[];
}

export interface IndependenceVerdict {
  independentSupportCount: number;
  totalCandidates: number;
  groups: IndependenceGroup[];
  verdict: 'no_candidates' | 'single_underlying_source' | 'multiple_underlying_sources';
  explanation: string;
}

export interface DiscoveryResult {
  recipeId: string;
  sourceClass: string;
  status: DiscoveryStatus;
  candidates: DiscoveryCandidate[];
  queryUsed: string;
  endpoints: string[];
  independence: IndependenceVerdict;
  retrievedAt: string;
  errors: string[];
}

export interface DiscoveryAdapter {
  recipeId: string;
  sourceClass: string;
  discover(question: string, context?: DiscoveryContext): Promise<DiscoveryResult>;
}

export class DiscoveryAdapterError extends Error {
  constructor(
    public readonly status: Exclude<DiscoveryStatus, 'DISCOVERY_COMPLETE' | 'DISCOVERY_EMPTY' | 'DISCOVERY_PARTIAL' | 'RESEARCH_REQUIRED' | 'RECIPE_NOT_FOUND'>,
    message: string,
  ) {
    super(message);
    this.name = 'DiscoveryAdapterError';
  }
}
