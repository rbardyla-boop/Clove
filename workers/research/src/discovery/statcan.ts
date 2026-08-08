import { evaluateSourceIndependence } from './independence';
import {
  absoluteUrl,
  errorMessage,
  fetchJson,
  normalizeText,
  nowIso,
} from './normalize';
import type {
  DiscoveryAdapter,
  DiscoveryCandidate,
  DiscoveryContext,
  DiscoveryResult,
} from './types';

const WDS_BASE = 'https://www150.statcan.gc.ca/t1/wds/rest';
const CUBE_INDEX_ENDPOINT = `${WDS_BASE}/getAllCubesListLite`;
const CUBE_METADATA_ENDPOINT = `${WDS_BASE}/getCubeMetadata`;
const MAX_INDEX_BYTES = 8 * 1024 * 1024;
const MAX_METADATA_BYTES = 512 * 1024;
const MAX_METADATA_CANDIDATES = 3;

const FREQUENCIES: Record<number, string> = {
  1: 'Daily',
  2: 'Weekly',
  6: 'Monthly',
  9: 'Quarterly',
  11: 'Semi-annual',
  12: 'Annual',
};

interface CubeIndexRecord {
  productId?: number | string;
  cansimId?: string | null;
  cubeTitleEn?: string;
  frequencyCode?: number;
  cubeStartDate?: string;
  cubeEndDate?: string;
  releaseTime?: string;
  issueDate?: string;
  archived?: string | number;
}

interface CubeDimension {
  dimensionNameEn?: string;
  member?: Array<{ memberNameEn?: string }>;
}

interface CubeMetadata extends CubeIndexRecord {
  archiveStatusCode?: string | number;
  archiveStatusEn?: string;
  dimension?: CubeDimension[];
}

function asProductId(value: unknown): number | null {
  const productId = Number(value);
  return Number.isInteger(productId) && productId > 0 ? productId : null;
}

function isCanadaPopulationCube(cube: CubeIndexRecord): boolean {
  return normalizeText(cube.cubeTitleEn ?? '').includes('population');
}

function scoreCube(cube: CubeIndexRecord): number {
  const title = normalizeText(cube.cubeTitleEn ?? '');
  let score = 0;
  if (title.includes('population estimates on july 1')) score += 10;
  if (title.includes('population estimates')) score += 6;
  if (title.includes('canada')) score += 3;
  if (cube.frequencyCode === 12) score += 4;
  if (String(cube.archived) === '2') score += 2;
  if (title.includes('quarterly')) score -= 1;
  if (title.includes('projected')) score -= 5;
  if (title.includes('inactive')) score -= 8;
  return score;
}

function hasCanadaGeography(metadata: CubeMetadata): boolean {
  return (metadata.dimension ?? []).some((dimension) =>
    normalizeText(dimension.dimensionNameEn ?? '') === 'geography'
    && (dimension.member ?? []).some((member) => normalizeText(member.memberNameEn ?? '') === 'canada'),
  );
}

function result(
  status: DiscoveryResult['status'],
  question: string,
  context: DiscoveryContext | undefined,
  candidates: DiscoveryCandidate[],
  errors: string[],
): DiscoveryResult {
  return {
    recipeId: 'official_canadian_statistic',
    sourceClass: 'official_canadian_statistic',
    status,
    candidates,
    queryUsed: question,
    endpoints: [CUBE_INDEX_ENDPOINT, CUBE_METADATA_ENDPOINT],
    independence: evaluateSourceIndependence(candidates),
    retrievedAt: nowIso(context),
    errors,
  };
}

export const statcanAdapter: DiscoveryAdapter = {
  recipeId: 'official_canadian_statistic',
  sourceClass: 'official_canadian_statistic',
  async discover(question, context = {}) {
    let index: CubeIndexRecord[];
    try {
      index = await fetchJson<CubeIndexRecord[]>(CUBE_INDEX_ENDPOINT, context, { maxBytes: MAX_INDEX_BYTES });
    } catch (error) {
      return result(error instanceof Error && 'status' in error ? (error as { status: DiscoveryResult['status'] }).status : 'SOURCE_UNAVAILABLE', question, context, [], [errorMessage(error)]);
    }

    const ranked = index
      .filter(isCanadaPopulationCube)
      .sort((left, right) => scoreCube(right) - scoreCube(left))
      .slice(0, MAX_METADATA_CANDIDATES);
    if (ranked.length === 0) return result('DISCOVERY_EMPTY', question, context, [], []);

    const candidates: DiscoveryCandidate[] = [];
    const errors: string[] = [];
    for (const cube of ranked) {
      const productId = asProductId(cube.productId);
      if (!productId) {
        errors.push('invalid_product_id');
        continue;
      }
      try {
        const response = await fetchJson<Array<{ status?: string; object?: CubeMetadata }>>(
          CUBE_METADATA_ENDPOINT,
          context,
          { method: 'POST', body: JSON.stringify([{ productId }]), maxBytes: MAX_METADATA_BYTES },
        );
        const metadata = response[0]?.object;
        if (!metadata || !hasCanadaGeography(metadata)) {
          errors.push(`geography_validation_failed:${productId}`);
          continue;
        }
        const frequency = FREQUENCIES[Number(metadata.frequencyCode ?? cube.frequencyCode)] ?? `code_${metadata.frequencyCode ?? cube.frequencyCode}`;
        const title = metadata.cubeTitleEn ?? cube.cubeTitleEn ?? `Statistics Canada cube ${productId}`;
        candidates.push({
          sourceId: `statcan-cube-${productId}`,
          sourceClass: 'official_canadian_statistic',
          title,
          url: `https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${productId}01`,
          authority: 'primary',
          institution: 'Statistics Canada',
          publishedAt: metadata.issueDate ?? cube.issueDate ?? cube.releaseTime,
          measurementPeriod: `${frequency}; table_end=${(metadata.cubeEndDate ?? cube.cubeEndDate ?? '').slice(0, 10)}; reference_period_rule=${normalizeText(title).includes('july 1') ? 'July 1' : 'source_defined'}`,
          identifiers: {
            productId: String(productId),
            ...(metadata.cansimId ?? cube.cansimId ? { cansimId: String(metadata.cansimId ?? cube.cansimId) } : {}),
            frequencyCode: String(metadata.frequencyCode ?? cube.frequencyCode ?? ''),
            frequency,
            archiveStatusCode: String(metadata.archiveStatusCode ?? cube.archived ?? ''),
            archiveStatus: metadata.archiveStatusEn ?? 'source_defined',
            geography: 'Canada',
            metadataEndpoint: CUBE_METADATA_ENDPOINT,
            referencePeriodEndpointTemplate: `${WDS_BASE}/getDataFromVectorByReferencePeriodRange`,
            dataRetrievalMode: 'metadata_then_reference_period_or_vector',
          },
          discoveryMethod: 'statcan_wds:getAllCubesListLite+getCubeMetadata',
          queryUsed: question,
          provenance: {
            provider: 'Statistics Canada Web Data Service',
            retrievedAt: nowIso(context),
            endpoint: CUBE_METADATA_ENDPOINT,
          },
        });
      } catch (error) {
        errors.push(`${productId}:${errorMessage(error)}`);
      }
    }

    const status = candidates.length === 0
      ? 'DISCOVERY_PARTIAL'
      : errors.length > 0
        ? 'DISCOVERY_PARTIAL'
        : 'DISCOVERY_COMPLETE';
    return result(status, question, context, candidates, errors);
  },
};

export function statcanMetadataUrl(): string {
  return absoluteUrl('getCubeMetadata', `${WDS_BASE}/`);
}
