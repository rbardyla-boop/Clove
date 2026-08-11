import { isSupportedSoftwoodTrade, tradeSpecificationFor } from './trade';

export type ResearchIntentKind =
  | 'population'
  | 'electoral_participation'
  | 'unemployment'
  | 'mortality'
  | 'immigration'
  | 'housing'
  | 'criminal_justice'
  | 'study_count'
  | 'electricity_generation'
  | 'canadian_law'
  | 'scientific_finding'
  | 'canadian_trade_statistic'
  | 'unknown';

export interface ResearchIntent {
  kind: ResearchIntentKind;
  subject: string;
  requestedMeasure: string;
  geography?: string;
  event?: string;
  timeScope?: string;
  population?: string;
  commodity?: string;
  direction?: 'export' | 'import';
  partner?: string;
  period?: string;
  measure?: 'physical_quantity' | 'value' | 'unknown';
  requestedUnit?: string;
  requiredConcepts: string[];
  ambiguities: string[];
}

export interface AlignmentPreflightContext {
  selectedRecipeId?: string;
  boundedSpecification: boolean;
}

export interface AlignmentPreflight {
  allowed: boolean;
  status: 'PASS' | 'RESEARCH_REQUIRED';
  reason: string;
}

export interface AlignmentClaim {
  id: string;
  proposition: string;
  unit?: string;
  geography?: string;
  population?: string;
  sourceType: string;
  sourceFragment?: string;
  evidenceRole?: 'supports' | 'contradicts' | 'qualifies' | 'context' | 'metadata_only';
  validation?: {
    geographyMatched: boolean | 'not_applicable';
  };
}

export interface ClaimApplicability {
  claimId: string;
  applicable: boolean;
  reasons: string[];
}

export interface AlignmentReport {
  status: 'PASS' | 'RESEARCH_REQUIRED';
  intent: ResearchIntent;
  claims: ClaimApplicability[];
  survivingClaimIds: string[];
  rejectedClaimIds: string[];
  reason: string;
}

function normalizeQuestion(question: string): string {
  return question
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9% ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(question: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(question));
}

function geographyFor(question: string): string | undefined {
  return /\bcanada\b|\bcanadian\b/.test(question) ? 'Canada' : undefined;
}

function intent(
  kind: ResearchIntentKind,
  subject: string,
  requestedMeasure: string,
  question: string,
  requiredConcepts: string[],
  details: Partial<ResearchIntent> = {},
): ResearchIntent {
  return {
    kind,
    subject,
    requestedMeasure,
    geography: details.geography ?? geographyFor(question),
    event: details.event,
    timeScope: details.timeScope,
    population: details.population,
    commodity: details.commodity,
    direction: details.direction,
    partner: details.partner,
    period: details.period,
    measure: details.measure,
    requestedUnit: details.requestedUnit,
    requiredConcepts,
    ambiguities: details.ambiguities ?? [],
  };
}

/**
 * Deterministic semantic preflight. This is deliberately conservative: a
 * broad source recipe is not evidence that the question asks for that
 * recipe's canonical measure.
 */
export function researchIntentFor(question: string): ResearchIntent {
  const normalized = normalizeQuestion(question);
  const geography = geographyFor(normalized);

  const trade = tradeSpecificationFor(normalized);
  if (trade) {
    const requestedMeasure = trade.measure === 'value'
      ? 'trade value'
      : trade.requestedUnit
        ? `physical quantity in ${trade.requestedUnit}`
        : 'physical trade quantity';
    return intent(
      'canadian_trade_statistic',
      'Canadian trade',
      requestedMeasure,
      normalized,
      ['commodity', 'trade direction', 'partner country', 'reference period', 'original unit', 'conversion if requested'],
      {
        geography,
        commodity: trade.commodity,
        direction: trade.direction,
        partner: trade.partner || undefined,
        period: trade.period || undefined,
        timeScope: trade.period ? `calendar year ${trade.period}` : undefined,
        measure: trade.measure,
        requestedUnit: trade.requestedUnit,
        ambiguities: trade.ambiguities,
      },
    );
  }

  if (hasAny(normalized, [/\belection\b/, /\bvot(?:e|ed|er|ers|ing)?\b/, /\bballot\b/, /\bturnout\b/, /\belector\b/, /\bnon[- ]?voter\b/])) {
    const asksForNonVoters = /\bdid not vote\b|\bdidn't vote\b|\bnon[- ]?voters?\b|\bnon[- ]?participation\b|\babstention\b/.test(normalized);
    return intent(
      'electoral_participation',
      'electoral participation',
      asksForNonVoters ? 'number of people who did not vote' : 'electoral participation measure',
      normalized,
      ['election', 'voter or elector population', asksForNonVoters ? 'non-participation' : 'votes or turnout'],
      {
        geography,
        event: 'latest election',
        timeScope: 'latest completed election event',
        population: 'eligible or registered electors (not specified)',
        ambiguities: [
          'The jurisdiction is not specified: federal, provincial, territorial, or local election.',
          'The denominator is not specified: eligible electors or registered electors.',
        ],
      },
    );
  }

  if (hasAny(normalized, [/\bunemploy(?:ed|ment)?\b/, /\bjobless\b/])) {
    return intent('unemployment', 'employment status', 'number or rate of unemployed people', normalized, ['unemployment', 'labor-force denominator'], {
      geography,
      timeScope: /\blast year\b|\blatest\b/.test(normalized) ? 'latest requested period' : undefined,
    });
  }

  if (hasAny(normalized, [/\bdied\b/, /\bdeaths?\b/, /\bmortality\b/])) {
    return intent('mortality', 'mortality', 'number of deaths', normalized, ['death event', 'cause or all-cause denominator'], {
      geography,
      timeScope: /\blast year\b|\blatest\b/.test(normalized) ? 'latest requested period' : undefined,
    });
  }

  if (hasAny(normalized, [/\bimmigrat(?:e|ed|ion|ing)\b/, /\bmigrat(?:e|ed|ion|ing)\b/])) {
    return intent('immigration', 'immigration', 'number of immigrants', normalized, ['immigration event', 'reference period'], {
      geography,
      timeScope: /\blast year\b|\blatest\b/.test(normalized) ? 'latest requested period' : undefined,
    });
  }

  if (hasAny(normalized, [/\bhome ownership\b/, /\bhomeowners?\b/, /\bown a home\b/, /\bown(?:ed|ing)? homes?\b/])) {
    return intent('housing', 'housing tenure', 'number or share of homeowners', normalized, ['home ownership', 'housing denominator'], { geography });
  }

  if (hasAny(normalized, [/\bconvictions?\b/, /\bconvicted\b/, /\bfound guilty\b/])) {
    return intent('criminal_justice', 'criminal justice outcomes', 'number of convictions or guilty findings', normalized, ['conviction event', 'offence or jurisdiction'], { geography });
  }

  if (/\b(?:how many|number of|count of)\b[^?]*\b(?:studies|papers|articles)\b/.test(normalized)) {
    return intent('study_count', 'scholarly works', 'number of studies or papers', normalized, ['study record', 'deduplication rule'], { geography });
  }

  if (hasAny(normalized, [/\bpopulation\b/, /\bhow many people live\b/])) {
    return intent('population', 'population', 'population count', normalized, ['population', 'persons', 'reference period'], {
      geography,
      timeScope: /\blast year\b|\blatest\b|\bannual\b/.test(normalized) ? 'latest complete requested period' : undefined,
      population: 'all ages; total gender unless otherwise specified',
    });
  }

  if (hasAny(normalized, [/\belectricity\b/, /\bgeneration\b/, /\bnuclear power\b/, /\bnuclear\b/])) {
    return intent('electricity_generation', 'electricity generation', 'generation share or generation amount', normalized, ['electricity generation', 'generation rather than capacity', 'reference period'], { geography });
  }

  if (hasAny(normalized, [/\blaw\b/, /\blegal\b/, /\bstatute\b/, /\bregulation\b/, /\bcannabis\b/, /\bcourt\b/])) {
    return intent('canadian_law', 'Canadian law', 'applicable legal rule or provision', normalized, ['legal instrument', 'jurisdiction', 'in-force status'], { geography });
  }

  if (hasAny(normalized, [/\bsupplementation\b/, /\brandomized\b/, /\bpeer reviewed\b/, /\bsample size\b/, /\bconfidence interval\b/, /\bscientific\b/, /\bcognitive performance\b/])) {
    return intent('scientific_finding', 'scientific finding', 'study result or evidence strength', normalized, ['study population', 'outcome', 'effect or uncertainty'], { geography });
  }

  return intent('unknown', 'unclassified subject', 'unclassified measure', normalized, [], {
    geography,
    ambiguities: ['The question did not match a deterministic supported research intent.'],
  });
}

export function preflightAlignment(intentValue: ResearchIntent, context: AlignmentPreflightContext): AlignmentPreflight {
  if (intentValue.kind === 'population' && context.selectedRecipeId === 'official_canadian_statistic') {
    return { allowed: true, status: 'PASS', reason: 'The question requests population and the selected recipe is a population-capable official-statistics path.' };
  }
  if (intentValue.kind === 'canadian_law' && context.selectedRecipeId === 'canadian_law') {
    return { allowed: true, status: 'PASS', reason: 'The question requests a legal rule and the selected recipe is a Canadian-law path.' };
  }
  if (intentValue.kind === 'scientific_finding' && context.selectedRecipeId === 'scientific_finding') {
    return { allowed: true, status: 'PASS', reason: 'The question requests a scientific finding and the selected recipe is a scientific-discovery path.' };
  }
  if (intentValue.kind === 'electricity_generation' && context.boundedSpecification) {
    return { allowed: true, status: 'PASS', reason: 'The exact bounded electricity specification matched.' };
  }
  if (intentValue.kind === 'canadian_trade_statistic' && context.selectedRecipeId === 'canadian_trade_statistic' && isSupportedSoftwoodTrade({
    commodity: intentValue.commodity ?? '',
    direction: intentValue.direction ?? 'export',
    partner: intentValue.partner ?? '',
    period: intentValue.period ?? '',
    measure: intentValue.measure ?? 'unknown',
    requestedUnit: intentValue.requestedUnit,
    ambiguities: intentValue.ambiguities,
  })) {
    return { allowed: true, status: 'PASS', reason: 'The bounded Canadian softwood-lumber export specification matched.' };
  }
  return {
    allowed: false,
    status: 'RESEARCH_REQUIRED',
    reason: `No bounded evidence path is authorized to answer the requested measure (${intentValue.requestedMeasure}). A source recipe match cannot substitute a different measure.`,
  };
}

function claimText(claim: AlignmentClaim): string {
  return [claim.proposition, claim.unit, claim.geography, claim.population, claim.sourceType, claim.sourceFragment]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function checkClaimApplicability(intentValue: ResearchIntent, claim: AlignmentClaim): ClaimApplicability {
  const text = claimText(claim);
  const reasons: string[] = [];
  const claimGeography = claim.geography?.toLowerCase();
  const geographyValidated = claim.validation?.geographyMatched;
  const hasCanada = !intentValue.geography
    || Boolean(claimGeography?.includes('canada'))
    || text.includes('canada')
    || geographyValidated === true
    || geographyValidated === 'not_applicable';
  if (!hasCanada) reasons.push('geography does not match the requested geography');

  let applicable = hasCanada;
  switch (intentValue.kind) {
    case 'population':
      applicable = applicable && text.includes('population') && claim.unit === 'persons';
      if (!text.includes('population')) reasons.push('claim does not measure population');
      if (claim.unit !== 'persons') reasons.push('claim unit is not persons');
      break;
    case 'electoral_participation':
      applicable = applicable && /\belection|\bvot|\bballot|\bturnout|\belector/.test(text);
      if (!/\belection|\bvot|\bballot|\bturnout|\belector/.test(text)) reasons.push('claim does not refer to the election or voting measure requested');
      break;
    case 'unemployment':
      applicable = applicable && /\bunemploy|\bjobless|\blabor force|\blabour force/.test(text);
      if (!/\bunemploy|\bjobless/.test(text)) reasons.push('claim does not measure unemployment');
      break;
    case 'mortality':
      applicable = applicable && /\bdeath|\bdied|\bmortality/.test(text);
      if (!/\bdeath|\bdied|\bmortality/.test(text)) reasons.push('claim does not measure mortality');
      break;
    case 'immigration':
      applicable = applicable && /\bimmigrat|\bmigrat/.test(text);
      if (!/\bimmigrat|\bmigrat/.test(text)) reasons.push('claim does not measure immigration');
      break;
    case 'housing':
      applicable = applicable && /\bhome owner|\bhomeowner|\bhousing tenure|\bown a home/.test(text);
      if (!/\bhome owner|\bhomeowner|\bhousing tenure|\bown a home/.test(text)) reasons.push('claim does not measure home ownership');
      break;
    case 'criminal_justice':
      applicable = applicable && /\bconvict|\bguilty|\bcriminal justice/.test(text);
      if (!/\bconvict|\bguilty|\bcriminal justice/.test(text)) reasons.push('claim does not measure the requested justice outcome');
      break;
    case 'study_count':
      applicable = applicable && /\bstud(?:y|ies)|\bpaper|\barticle|\bwork/.test(text);
      if (!/\bstud(?:y|ies)|\bpaper|\barticle|\bwork/.test(text)) reasons.push('claim does not count scholarly works');
      break;
    case 'electricity_generation':
      applicable = applicable && /\belectricity|\bgeneration|\bnuclear|\btwh|\bmegawatt/.test(text);
      if (!/\belectricity|\bgeneration|\bnuclear|\btwh|\bmegawatt/.test(text)) reasons.push('claim does not measure electricity generation');
      break;
    case 'canadian_law':
      applicable = applicable && /\bact\b|\blaw\b|\bstatute\b|\bregulation\b|\blegal\b|\bjustice laws/.test(text);
      if (!/\bact\b|\blaw\b|\bstatute\b|\bregulation\b|\blegal\b/.test(text)) reasons.push('claim is not legal text or a bounded legal interpretation');
      break;
    case 'scientific_finding':
      applicable = applicable && /\bstudy|\bstudies|\bscientific|\bcrossref|\babstract|\btrial|\bmeta analysis|\beffect|\bscholarly|does not establish|evidence boundary/.test(text);
      if (!/\bstudy|\bstudies|\bscientific|\bcrossref|\babstract|\btrial|\bmeta analysis|\beffect|\bscholarly|does not establish|evidence boundary/.test(text)) reasons.push('claim is not scientific evidence');
      break;
    case 'canadian_trade_statistic': {
      const contextual = claim.evidenceRole === 'context' || claim.evidenceRole === 'qualifies';
      const commodityMatched = /\bsoftwood\b|\blumber\b/.test(text);
      const directionMatched = /\bexport|\bexports/.test(text);
      const partnerMatched = /\bunited states\b|\bu s\b|\busa\b|\bus\b/.test(text);
      const periodMatched = contextual || !intentValue.period || text.includes(intentValue.period);
      const unitMatched = !intentValue.requestedUnit
        || /\bcubic metre|\bcubic meter|\bm3\b/.test(text)
        || claim.unit === intentValue.requestedUnit
        || claim.unit === 'board feet';
      applicable = applicable
        && commodityMatched
        && periodMatched
        && (contextual || (directionMatched && partnerMatched && unitMatched));
      if (!commodityMatched) reasons.push('claim is not about the requested softwood-lumber commodity');
      if (!contextual && !directionMatched) reasons.push('claim does not establish the requested export direction');
      if (!contextual && !partnerMatched) reasons.push('claim does not establish the requested United States partner');
      if (!periodMatched) reasons.push('claim does not establish the requested reference year');
      if (!contextual && !unitMatched) reasons.push('claim does not establish the requested unit or its conversion');
      break;
    }
    case 'unknown':
      applicable = false;
      reasons.push('question intent is not classified');
      break;
  }
  return { claimId: claim.id, applicable, reasons };
}

export function alignmentReportFor(
  intentValue: ResearchIntent,
  claims: AlignmentClaim[],
  answerClaimIds: string[],
): AlignmentReport {
  const checks = claims.map((claim) => checkClaimApplicability(intentValue, claim));
  const survivingClaimIds = checks.filter((check) => check.applicable).map((check) => check.claimId);
  const rejectedClaimIds = checks.filter((check) => !check.applicable).map((check) => check.claimId);
  const rejectedAnswerClaim = answerClaimIds.some((id) => rejectedClaimIds.includes(id));
  const status = rejectedAnswerClaim || answerClaimIds.filter((id) => survivingClaimIds.includes(id)).length === 0
    ? 'RESEARCH_REQUIRED'
    : 'PASS';
  return {
    status,
    intent: intentValue,
    claims: checks,
    survivingClaimIds,
    rejectedClaimIds,
    reason: status === 'PASS'
      ? 'Every claim used in the answer matches the requested subject, measure, geography, and source domain.'
      : 'At least one answer claim is inapplicable to the requested measure, so synthesis must stop.',
  };
}
