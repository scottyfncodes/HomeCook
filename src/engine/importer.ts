/**
 * Importing old recipes — the HelloFresh box archive, mostly.
 *
 * The point is not to keep the documents; it is to get structure out of them:
 * what protein, what cuisine, what flavours, what it takes to cook. That
 * structure is what the taste profile reads. Anything that cannot be parsed is
 * reported rather than silently dropped, and an ingredient the catalogue has
 * never heard of becomes an honest "no price estimate" entry instead of an
 * invented price.
 */
import type {
  Cuisine,
  CookingMethod,
  FlavorTag,
  Ingredient,
  MealFormat,
  Protein,
  Recipe,
  RecipeIngredient,
  Unit,
} from '@homecook/core/types';
import { matchIngredient } from '@homecook/data/ingredients';
import { deriveDietary } from '@homecook/engine/dietary';
import { toCanonical } from '@homecook/engine/pricing';

export interface ImportOutcome {
  recipes: Recipe[];
  customIngredients: Ingredient[];
  /** Blocks that produced nothing usable, with why. */
  skipped: string[];
}

const UNIT_WORDS: Record<string, Unit> = {
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  ml: 'ml', milliliter: 'ml',
  l: 'l', liter: 'l', litre: 'l',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  cup: 'cup', cups: 'cup',
  clove: 'clove', cloves: 'clove',
  bunch: 'bunch', bunches: 'bunch',
  can: 'can', cans: 'can', tin: 'can',
  slice: 'slice', slices: 'slice',
  unit: 'count', units: 'count', piece: 'count', pieces: 'count',
};

const GLYPH_FRACTIONS: Record<string, number> = {
  '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125,
};

function parseQuantity(token: string): number | null {
  const glyph = GLYPH_FRACTIONS[token];
  if (glyph) return glyph;
  if (/^\d+\/\d+$/.test(token)) {
    const [a, b] = token.split('/').map(Number);
    return b ? a! / b! : null;
  }
  const n = Number(token);
  return Number.isFinite(n) ? n : null;
}

interface ParsedLine {
  qty: number;
  unit: Unit;
  name: string;
}

/** "1 1/2 lb boneless chicken thighs, diced" → { 1.5, lb, chicken thighs } */
export function parseIngredientLine(line: string): ParsedLine | null {
  const cleaned = line
    .replace(/^[-•*•]\s*/, '')
    .replace(/\([^)]*\)/g, ' ')
    .trim();
  if (!cleaned) return null;

  const tokens = cleaned.split(/\s+/);
  let qty = 0;
  let index = 0;
  while (index < tokens.length) {
    const value = parseQuantity(tokens[index]!.replace(/,$/, ''));
    if (value === null) break;
    qty += value;
    index += 1;
    if (index > 2) break;
  }

  let unit: Unit = 'count';
  if (index < tokens.length) {
    const word = tokens[index]!.toLowerCase().replace(/[.,]/g, '');
    const match = UNIT_WORDS[word];
    if (match) {
      unit = match;
      index += 1;
    }
  }

  const name = tokens.slice(index).join(' ').split(',')[0]!.trim();
  if (!name || name.length < 2) return null;
  return { qty: qty > 0 ? qty : 1, unit, name };
}

const PROTEIN_HINTS: [Protein, RegExp][] = [
  ['seafood', /shrimp|salmon|cod|fish|tuna|scallop|prawn/i],
  ['sausage', /sausage|bratwurst|kielbasa/i],
  ['pork', /pork|bacon|chorizo|ham\b/i],
  ['beef', /beef|steak|sirloin|brisket|meatball/i],
  ['turkey', /turkey/i],
  ['chicken', /chicken/i],
];

const CUISINE_HINTS: [Cuisine, RegExp][] = [
  ['korean', /korean|gochujang|bulgogi|kimchi/i],
  ['thai', /thai|coconut curry|peanut|lemongrass/i],
  ['indian', /indian|tikka|masala|curry powder|naan|paneer/i],
  ['mexican', /mexican|taco|fajita|burrito|salsa|chipotle|southwest|enchilada/i],
  ['italian', /italian|pasta|parmesan|marinara|pesto|risotto|tuscan|gnocchi/i],
  ['mediterranean', /greek|mediterranean|feta|tzatziki|hummus|orzo/i],
  ['asian', /teriyaki|soy|stir-?fry|sesame|hoisin|ramen|udon/i],
  ['french', /french|dijon|herbes|gratin|beurre/i],
];

const FLAVOR_HINTS: [FlavorTag, RegExp][] = [
  ['creamy', /cream|alfredo|coconut milk|cheese sauce/i],
  ['cheesy', /cheese|parmesan|mozzarella|cheddar|feta/i],
  ['spicy', /spicy|chili|jalape|sriracha|gochujang|cayenne|harissa/i],
  ['smoky', /smoked|chipotle|paprika|bbq|barbecue/i],
  ['sweet-savory', /honey|teriyaki|maple|brown sugar|glaze/i],
  ['citrus', /lemon|lime|citrus|orange/i],
  ['garlic-forward', /garlic/i],
  ['herb-forward', /herb|basil|thyme|rosemary|parsley|cilantro|oregano/i],
  ['umami', /soy|miso|mushroom|anchovy|fish sauce/i],
  ['fresh', /salad|slaw|cucumber|fresh/i],
];

const METHOD_HINTS: [CookingMethod, RegExp][] = [
  ['sheet-pan', /sheet.?pan|tray bake/i],
  ['oven', /bake|roast|oven/i],
  ['one-pot', /one.?pot|one.?pan|soup|stew|chili|curry/i],
  ['grill', /grill/i],
  ['slow', /slow cooker|braise/i],
  ['no-cook', /no.?cook|salad only/i],
];

const FORMAT_HINTS: [MealFormat, RegExp][] = [
  ['tacos', /taco|tostada|quesadilla/i],
  ['bowls', /bowl/i],
  ['pasta', /pasta|spaghetti|linguine|penne|noodle|orzo/i],
  ['soup', /soup|chili|stew|chowder/i],
  ['curry', /curry|masala|tikka/i],
  ['sandwich', /sandwich|burger|melt|sub|wrap/i],
  ['salad', /salad/i],
  ['stir-fry', /stir.?fry/i],
  ['bake', /bake|casserole|gratin/i],
  ['sheet-pan', /sheet.?pan/i],
  ['roast', /roast/i],
];

function firstMatch<T>(hints: [T, RegExp][], text: string, fallback: T): T {
  for (const [value, pattern] of hints) if (pattern.test(text)) return value;
  return fallback;
}

export interface RecipeDraft {
  name: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  cuisine?: string;
  ingredientLines: string[];
  steps?: string[];
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48);
}

/** Turn a draft into a real recipe, inventing ad-hoc ingredients where needed. */
export function buildRecipe(draft: RecipeDraft, now = Date.now()): {
  recipe: Recipe;
  customIngredients: Ingredient[];
  matched: number;
} {
  const ingredients: RecipeIngredient[] = [];
  const custom: Ingredient[] = [];
  let matched = 0;

  for (const line of draft.ingredientLines) {
    const parsed = parseIngredientLine(line);
    if (!parsed) continue;
    const known = matchIngredient(parsed.name);
    if (known && toCanonical(known, parsed.qty, parsed.unit) !== null) {
      matched += 1;
      ingredients.push({ ingredientId: known.id, qty: parsed.qty, unit: parsed.unit });
      continue;
    }
    const id = `x_${slug(parsed.name)}`;
    if (!custom.some((c) => c.id === id)) {
      custom.push({
        id,
        name: parsed.name.replace(/\b\w/g, (c) => c.toUpperCase()),
        category: 'other',
        unit: parsed.unit,
        pkg: { size: 1, unit: parsed.unit, price: 0, label: 'no price estimate' },
        priced: false,
      });
    }
    ingredients.push({ ingredientId: id, qty: parsed.qty, unit: parsed.unit });
  }

  const haystack = [draft.name, draft.cuisine ?? '', ...draft.ingredientLines, ...(draft.steps ?? [])].join(' ');
  const flavorTags = FLAVOR_HINTS.filter(([, pattern]) => pattern.test(haystack))
    .map(([tag]) => tag)
    .slice(0, 4);

  const recipe: Recipe = {
    id: `imported_${slug(draft.name)}_${String(now).slice(-5)}`,
    name: draft.name,
    emoji: '📒',
    description: 'Imported from your recipe history.',
    ingredients,
    servings: draft.servings && draft.servings > 0 ? draft.servings : 2,
    prepTime: draft.prepTime ?? 10,
    cookTime: draft.cookTime ?? 25,
    cuisine: firstMatch(CUISINE_HINTS, haystack, 'american'),
    protein: firstMatch(PROTEIN_HINTS, haystack, 'vegetarian'),
    cookingMethod: firstMatch(METHOD_HINTS, haystack, 'skillet'),
    format: firstMatch(FORMAT_HINTS, haystack, 'skillet'),
    flavorTags: flavorTags.length ? flavorTags : ['savory'],
    dietaryTags: deriveDietary(ingredients),
    difficulty: 'easy',
    leftoverPotential: 'medium',
    steps: draft.steps ?? [],
    source: 'imported',
    // Plannable only when most of it resolved to real, priceable ingredients.
    planReady: ingredients.length >= 3 && matched / Math.max(1, ingredients.length) >= 0.6,
    importedAt: now,
  };

  return { recipe, customIngredients: custom, matched };
}

const INGREDIENT_HEADER = /^\s*(ingredients|you'?ll need|shopping list)\s*:?\s*$/i;
const STEP_HEADER = /^\s*(instructions|directions|steps|method|preparation)\s*:?\s*$/i;

/** Parse one pasted recipe card. */
export function parseTextBlock(block: string): RecipeDraft | null {
  const lines = block.split(/\r?\n/).map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);
  if (nonEmpty.length < 2) return null;

  const name = nonEmpty[0]!.replace(/^#+\s*/, '').replace(/\s*\|.*$/, '').trim();
  if (!name) return null;

  const servings = Number(/serves\s+(\d+)|(\d+)\s+servings?/i.exec(block)?.[1] ?? /serves\s+(\d+)|(\d+)\s+servings?/i.exec(block)?.[2] ?? NaN);
  const totalTime = Number(/(?:total time|ready in|time)\D{0,12}(\d+)\s*min/i.exec(block)?.[1] ?? NaN);
  const prepTime = Number(/prep\D{0,12}(\d+)\s*min/i.exec(block)?.[1] ?? NaN);
  const cookTime = Number(/cook\D{0,12}(\d+)\s*min/i.exec(block)?.[1] ?? NaN);

  const ingredientLines: string[] = [];
  const steps: string[] = [];
  let mode: 'head' | 'ingredients' | 'steps' = 'head';

  for (const line of lines.slice(1)) {
    if (!line) continue;
    if (INGREDIENT_HEADER.test(line)) {
      mode = 'ingredients';
      continue;
    }
    if (STEP_HEADER.test(line)) {
      mode = 'steps';
      continue;
    }
    if (mode === 'steps' || /^\d+\.\s+\w/.test(line)) {
      steps.push(line.replace(/^\d+\.\s*/, ''));
      continue;
    }
    // Without headers, a line that opens with a quantity is an ingredient.
    if (mode === 'ingredients' || /^[-•*]?\s*[\d½¼¾⅓⅔⅛]/.test(line)) {
      ingredientLines.push(line);
    }
  }

  if (ingredientLines.length === 0) return null;
  return {
    name,
    servings: Number.isFinite(servings) ? servings : undefined,
    prepTime: Number.isFinite(prepTime) ? prepTime : undefined,
    cookTime: Number.isFinite(cookTime)
      ? cookTime
      : Number.isFinite(totalTime)
        ? Math.max(5, totalTime - (Number.isFinite(prepTime) ? prepTime : 10))
        : undefined,
    ingredientLines,
    steps: steps.length ? steps : undefined,
  };
}

const SEPARATOR = /^\s*(?:-{3,}|={3,}|\*{3,})\s*$/;
const META_LINE = /^\s*(serves|servings|prep|cook|total|time|ready|difficulty|cuisine|calories)\b/i;
const STEP_LINE = /^\s*\d+[.)]\s+\S/;
const QUANTITY_LINE = /^[-•*]?\s*[\d½¼¾⅓⅔⅛]/;

/**
 * Split a paste into one block per recipe. A blank line alone is not a break —
 * recipe cards are full of them — so a new block starts at an explicit
 * separator, or at a title-looking line that follows a block which already has
 * its ingredients.
 */
function splitBlocks(text: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let hasIngredients = false;
  let blankBefore = false;

  const flush = () => {
    const block = current.join('\n').trim();
    if (block) blocks.push(block);
    current = [];
    hasIngredients = false;
  };

  for (const line of text.split(/\r?\n/)) {
    if (SEPARATOR.test(line)) {
      flush();
      blankBefore = false;
      continue;
    }
    if (!line.trim()) {
      if (current.length) current.push('');
      blankBefore = true;
      continue;
    }

    const isStep = STEP_LINE.test(line);
    const isQuantity = !isStep && QUANTITY_LINE.test(line);
    const isStructural =
      isStep || isQuantity || META_LINE.test(line) || INGREDIENT_HEADER.test(line) || STEP_HEADER.test(line);

    if (blankBefore && hasIngredients && !isStructural) flush();
    current.push(line);
    if (isQuantity) hasIngredients = true;
    blankBefore = false;
  }
  flush();
  return blocks;
}

export function importFromText(text: string, now = Date.now()): ImportOutcome {
  const outcome: ImportOutcome = { recipes: [], customIngredients: [], skipped: [] };
  for (const block of splitBlocks(text)) {
    const draft = parseTextBlock(block);
    if (!draft) {
      outcome.skipped.push(block.split('\n')[0]?.slice(0, 60) ?? 'unreadable block');
      continue;
    }
    const built = buildRecipe(draft, now + outcome.recipes.length);
    outcome.recipes.push(built.recipe);
    for (const item of built.customIngredients) {
      if (!outcome.customIngredients.some((c) => c.id === item.id)) outcome.customIngredients.push(item);
    }
  }
  return outcome;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      out.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  out.push(current.trim());
  return out;
}

/**
 * CSV with a header row. `name` is required; `ingredients` holds one line per
 * ingredient, separated by `;` or a newline inside the quoted cell.
 */
export function importFromCsv(text: string, now = Date.now()): ImportOutcome {
  const outcome: ImportOutcome = { recipes: [], customIngredients: [], skipped: [] };
  const rows = text.split(/\r?\n(?=(?:[^"]*"[^"]*")*[^"]*$)/).filter((l) => l.trim());
  if (rows.length < 2) return outcome;

  const header = splitCsvLine(rows[0]!).map((h) => h.toLowerCase());
  const col = (names: string[]): number => header.findIndex((h) => names.includes(h));
  const nameCol = col(['name', 'recipe', 'title', 'meal']);
  const ingCol = col(['ingredients', 'ingredient']);
  const servCol = col(['servings', 'serves']);
  const cuisineCol = col(['cuisine', 'style']);
  const timeCol = col(['time', 'total time', 'totaltime', 'minutes']);
  if (nameCol < 0) {
    outcome.skipped.push('No "name" column found');
    return outcome;
  }

  for (const row of rows.slice(1)) {
    const cells = splitCsvLine(row);
    const name = cells[nameCol];
    if (!name) continue;
    const ingredientLines = (ingCol >= 0 ? cells[ingCol] ?? '' : '')
      .split(/;|\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!ingredientLines.length) {
      outcome.skipped.push(`${name} — no ingredients column`);
      continue;
    }
    const built = buildRecipe(
      {
        name,
        ingredientLines,
        servings: servCol >= 0 ? Number(cells[servCol]) || undefined : undefined,
        cuisine: cuisineCol >= 0 ? cells[cuisineCol] : undefined,
        cookTime: timeCol >= 0 ? Number(cells[timeCol]) || undefined : undefined,
      },
      now + outcome.recipes.length,
    );
    outcome.recipes.push(built.recipe);
    for (const item of built.customIngredients) {
      if (!outcome.customIngredients.some((c) => c.id === item.id)) outcome.customIngredients.push(item);
    }
  }
  return outcome;
}

/** JSON: an array of drafts, or `{ recipes: [...] }`. */
export function importFromJson(text: string, now = Date.now()): ImportOutcome {
  const outcome: ImportOutcome = { recipes: [], customIngredients: [], skipped: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    outcome.skipped.push('File is not valid JSON');
    return outcome;
  }
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { recipes?: unknown }).recipes)
      ? (parsed as { recipes: unknown[] }).recipes
      : [];

  for (const entry of list) {
    const raw = entry as Record<string, unknown>;
    const name = typeof raw.name === 'string' ? raw.name : typeof raw.title === 'string' ? raw.title : '';
    if (!name) continue;
    const rawIngredients = raw.ingredients;
    const ingredientLines = Array.isArray(rawIngredients)
      ? rawIngredients.map((i) => (typeof i === 'string' ? i : String((i as { text?: string }).text ?? '')))
      : typeof rawIngredients === 'string'
        ? rawIngredients.split(/;|\r?\n/)
        : [];
    const lines = ingredientLines.map((l) => l.trim()).filter(Boolean);
    if (!lines.length) {
      outcome.skipped.push(`${name} — no ingredients`);
      continue;
    }
    const steps = Array.isArray(raw.steps)
      ? raw.steps.filter((s): s is string => typeof s === 'string')
      : undefined;
    const built = buildRecipe(
      {
        name,
        ingredientLines: lines,
        servings: typeof raw.servings === 'number' ? raw.servings : undefined,
        cuisine: typeof raw.cuisine === 'string' ? raw.cuisine : undefined,
        prepTime: typeof raw.prepTime === 'number' ? raw.prepTime : undefined,
        cookTime: typeof raw.cookTime === 'number' ? raw.cookTime : undefined,
        steps,
      },
      now + outcome.recipes.length,
    );
    outcome.recipes.push(built.recipe);
    for (const item of built.customIngredients) {
      if (!outcome.customIngredients.some((c) => c.id === item.id)) outcome.customIngredients.push(item);
    }
  }
  return outcome;
}

/** Pick a parser from the file name or the shape of the text. */
export function importRecipes(text: string, filename = '', now = Date.now()): ImportOutcome {
  const lower = filename.toLowerCase();
  const trimmed = text.trim();
  if (lower.endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return importFromJson(text, now);
  }
  if (lower.endsWith('.csv') || /^[^\n]*,[^\n]*\n/.test(trimmed)) {
    const csv = importFromCsv(text, now);
    if (csv.recipes.length) return csv;
  }
  return importFromText(text, now);
}
