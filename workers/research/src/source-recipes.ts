import registry from '../../../agent/source-recipes.json' with { type: 'json' };

export type RecipeId = keyof typeof registry.recipes;
export type RecipeConfidence = 'high' | 'medium';

export interface RecipePriority {
  rank: number;
  source_class: string;
  role: string;
}

export interface RecipeCheck {
  id: string;
  required: boolean;
  description: string;
}

export interface SourceRecipe {
  id: RecipeId;
  label: string;
  source_priority: RecipePriority[];
  preferred_access: string[];
  mandatory_checks: RecipeCheck[];
  freshness: {
    rule: string;
    must_label: string[];
  };
  challenge: {
    strategy: string;
    independence_check: string;
  };
  prohibited_source_roles: string[];
  routing: {
    all_of: string[];
    any_of: string[];
    none_of: string[];
  };
}

export interface RecipeEvaluation {
  recipeId: RecipeId;
  score: number;
  matchedAllOf: string[];
  matchedAnyOf: string[];
  blockedByNoneOf: string[];
  eligible: boolean;
}

export interface SourceRecipeSelection {
  recipe: SourceRecipe;
  confidence: RecipeConfidence;
  matchedSignals: string[];
  trace: RecipeEvaluation[];
}

export interface ResearchPlan {
  question: string;
  status: 'recipe_selected';
  recipe: SourceRecipe;
  confidence: RecipeConfidence;
  matchedSignals: string[];
  routingTrace: RecipeEvaluation[];
  answerStatus: 'not_run';
  nextSteps: string[];
}

export const SOURCE_RECIPES: readonly SourceRecipe[] = Object.freeze(
  Object.entries(registry.recipes).map(([id, recipe]) => ({ id: id as RecipeId, ...recipe })) as SourceRecipe[],
);

const RECIPE_BY_ID = new Map(SOURCE_RECIPES.map((recipe) => [recipe.id, recipe]));

function normalizeQuestion(question: string): string {
  return question
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9% ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesSignal(question: string, signal: string): boolean {
  return ` ${question} `.includes(` ${signal.toLowerCase()} `);
}

function evaluateRecipe(question: string, recipe: SourceRecipe): RecipeEvaluation {
  const matchedAllOf = recipe.routing.all_of.filter((signal) => matchesSignal(question, signal));
  const matchedAnyOf = recipe.routing.any_of.filter((signal) => matchesSignal(question, signal));
  const blockedByNoneOf = recipe.routing.none_of.filter((signal) => matchesSignal(question, signal));
  const allOfSatisfied = matchedAllOf.length === recipe.routing.all_of.length;
  const anyOfSatisfied = recipe.routing.any_of.length === 0 || matchedAnyOf.length > 0;
  const eligible = allOfSatisfied && anyOfSatisfied && blockedByNoneOf.length === 0;
  const score = eligible
    ? matchedAllOf.length * 5 + matchedAnyOf.length
    : 0;
  return { recipeId: recipe.id, score, matchedAllOf, matchedAnyOf, blockedByNoneOf, eligible };
}

export function selectSourceRecipe(question: string): SourceRecipeSelection | null {
  if (typeof question !== 'string' || question.trim().length === 0) return null;
  const normalized = normalizeQuestion(question);
  const trace = SOURCE_RECIPES.map((recipe) => evaluateRecipe(normalized, recipe));
  const eligible = trace
    .filter((evaluation) => evaluation.eligible)
    .sort((left, right) => right.score - left.score);
  const winner = eligible[0];
  if (!winner) return null;
  const recipe = RECIPE_BY_ID.get(winner.recipeId);
  if (!recipe) return null;
  const confidence: RecipeConfidence = winner.score >= 8 ? 'high' : 'medium';
  return {
    recipe,
    confidence,
    matchedSignals: [...winner.matchedAllOf, ...winner.matchedAnyOf],
    trace,
  };
}

export function buildResearchPlan(question: string, selection: SourceRecipeSelection): ResearchPlan {
  return {
    question,
    status: 'recipe_selected',
    recipe: selection.recipe,
    confidence: selection.confidence,
    matchedSignals: selection.matchedSignals,
    routingTrace: selection.trace,
    answerStatus: 'not_run',
    nextSteps: [
      'discover candidates using the recipe source priority',
      'retrieve through a preferred access method',
      'run every mandatory validation check',
      'execute the recipe challenge and independence check',
      'extract only supported claims or return an unresolved result',
    ],
  };
}

export function recipeHasStoredAnswer(recipe: SourceRecipe): boolean {
  const serialized = JSON.stringify(recipe).toLowerCase();
  return ['80.7', '622.2', '13.0', '14%'].some((answer) => serialized.includes(answer));
}
