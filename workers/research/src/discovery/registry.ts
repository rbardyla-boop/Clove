import { selectSourceRecipe, type RecipeId } from '../source-recipes';
import { crossrefAdapter } from './crossref';
import { justiceLawsAdapter } from './justice-laws';
import { statcanAdapter } from './statcan';
import type { DiscoveryContext, DiscoveryResult } from './types';

export const DISCOVERY_REGISTRY = Object.freeze({
  official_canadian_statistic: statcanAdapter,
  canadian_law: justiceLawsAdapter,
  scientific_finding: crossrefAdapter,
});

export type RegisteredDiscoveryRecipe = keyof typeof DISCOVERY_REGISTRY;

export function adapterForRecipe(recipeId: RecipeId): typeof DISCOVERY_REGISTRY[RegisteredDiscoveryRecipe] | null {
  return (DISCOVERY_REGISTRY as Record<string, typeof statcanAdapter>)[recipeId] ?? null;
}

export async function discoverQuestion(question: string, context: DiscoveryContext = {}): Promise<DiscoveryResult> {
  const selection = selectSourceRecipe(question);
  if (!selection) {
    return {
      recipeId: 'unknown',
      sourceClass: 'unknown',
      status: 'RECIPE_NOT_FOUND',
      candidates: [],
      queryUsed: question,
      endpoints: [],
      independence: {
        independentSupportCount: 0,
        totalCandidates: 0,
        groups: [],
        verdict: 'no_candidates',
        explanation: 'No deterministic source recipe matched this question.',
      },
      retrievedAt: (context.now ?? new Date()).toISOString(),
      errors: [],
    };
  }
  const adapter = adapterForRecipe(selection.recipe.id);
  if (!adapter) {
    return {
      recipeId: selection.recipe.id,
      sourceClass: selection.recipe.id,
      status: 'RECIPE_NOT_FOUND',
      candidates: [],
      queryUsed: question,
      endpoints: [],
      independence: {
        independentSupportCount: 0,
        totalCandidates: 0,
        groups: [],
        verdict: 'no_candidates',
        explanation: 'The recipe exists but has no registered discovery adapter.',
      },
      retrievedAt: (context.now ?? new Date()).toISOString(),
      errors: ['adapter_not_registered'],
    };
  }
  return adapter.discover(question, context);
}

export * from './types';
export * from './independence';
export { crossrefAdapter } from './crossref';
export { justiceLawsAdapter } from './justice-laws';
export { statcanAdapter } from './statcan';
