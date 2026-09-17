/**
 * HomeCook's domain model.
 *
 * Everything the planner, the grocery builder and the UI share lives here.
 * Two rules shape it:
 *  1. Household size and per-meal headcount are data, never constants — a week
 *     is planned for whoever is actually eating each night.
 *  2. Anything that could later come from a real price feed (package sizes,
 *     prices, stores) is already a separate, swappable layer.
 */

export type Category = 'produce' | 'meat' | 'dairy' | 'pantry' | 'frozen' | 'bakery' | 'other';

export const CATEGORY_ORDER: Category[] = [
  'produce',
  'meat',
  'dairy',
  'bakery',
  'frozen',
  'pantry',
  'other',
];

export const CATEGORY_LABEL: Record<Category, string> = {
  produce: 'Produce',
  meat: 'Meat & Seafood',
  dairy: 'Dairy',
  bakery: 'Bakery',
  frozen: 'Frozen',
  pantry: 'Pantry',
  other: 'Other',
};

/** Units are grouped into families; conversion only happens inside a family. */
export type Unit =
  | 'g'
  | 'kg'
  | 'oz'
  | 'lb'
  | 'ml'
  | 'l'
  | 'tsp'
  | 'tbsp'
  | 'cup'
  | 'count'
  | 'clove'
  | 'bunch'
  | 'can'
  | 'slice';

export type Protein =
  | 'chicken'
  | 'beef'
  | 'pork'
  | 'sausage'
  | 'seafood'
  | 'turkey'
  | 'vegetarian';

export type Cuisine =
  | 'american'
  | 'italian'
  | 'mexican'
  | 'mediterranean'
  | 'asian'
  | 'korean'
  | 'indian'
  | 'thai'
  | 'french';

export type CookingMethod = 'skillet' | 'oven' | 'sheet-pan' | 'one-pot' | 'grill' | 'slow' | 'no-cook';

export type MealFormat =
  | 'bowls'
  | 'tacos'
  | 'pasta'
  | 'skillet'
  | 'sheet-pan'
  | 'soup'
  | 'curry'
  | 'sandwich'
  | 'roast'
  | 'salad'
  | 'stir-fry'
  | 'bake';

export type FlavorTag =
  | 'savory'
  | 'spicy'
  | 'creamy'
  | 'cheesy'
  | 'smoky'
  | 'sweet-savory'
  | 'citrus'
  | 'garlic-forward'
  | 'herb-forward'
  | 'fresh'
  | 'umami';

export type DietaryTag =
  | 'vegetarian'
  | 'pescatarian'
  | 'gluten-free'
  | 'dairy-free'
  | 'pork-free'
  | 'nut-free';

export type Difficulty = 'easy' | 'medium' | 'involved';

export type LeftoverPotential = 'low' | 'medium' | 'high';

export interface PackageSpec {
  /** How much comes in one package, in `unit`. */
  size: number;
  unit: Unit;
  /** Baseline estimated shelf price for one package, before the store factor. */
  price: number;
  /** Shorthand shown on the list, e.g. "1 lb pack". */
  label?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  category: Category;
  /** Canonical unit the planner sums in. */
  unit: Unit;
  pkg: PackageSpec;
  /** Common household staple — offered on the pantry starter list. */
  staple?: boolean;
  /** Free-text names that should map onto this ingredient when importing. */
  aliases?: string[];
  /**
   * Weight of one cup, for dry goods recipes measure both ways ("1½ cups
   * orzo" vs "10 oz orzo"). Without it, volume and mass stay separate.
   */
  gramsPerCup?: number;
  /** False for ad-hoc ingredients created by an import: no trustworthy price. */
  priced?: boolean;
}

export interface RecipeIngredient {
  ingredientId: string;
  qty: number;
  unit: Unit;
  /** Skippable without changing the dish; still bought unless in the pantry. */
  optional?: boolean;
  note?: string;
}

export interface Recipe {
  id: string;
  name: string;
  emoji: string;
  description: string;
  ingredients: RecipeIngredient[];
  /** Servings the quantities above are written for. */
  servings: number;
  prepTime: number;
  cookTime: number;
  cuisine: Cuisine;
  protein: Protein;
  cookingMethod: CookingMethod;
  format: MealFormat;
  flavorTags: FlavorTag[];
  dietaryTags: DietaryTag[];
  difficulty: Difficulty;
  leftoverPotential: LeftoverPotential;
  steps: string[];
  source: 'library' | 'imported' | 'manual';
  /** Set on imported recipes whose ingredients could not all be resolved. */
  planReady?: boolean;
  importedAt?: number;
}

export const RATINGS = ['loved', 'good', 'fine', 'no', 'never'] as const;
export type Rating = (typeof RATINGS)[number];

export const RATING_LABEL: Record<Rating, string> = {
  loved: 'Loved it',
  good: 'Good',
  fine: 'Fine',
  no: "Don't make again",
  never: 'Never again',
};

export const RATING_EMOJI: Record<Rating, string> = {
  loved: '❤️',
  good: '👍',
  fine: '😐',
  no: '👎',
  never: '🚫',
};

export type LeftoverPreference = 'none' | 'sometimes' | 'frequently';

export interface Household {
  adults: number;
  children: number;
  guests: number;
}

export interface Settings {
  budget: number;
  mealsPerWeek: number;
  storeId: string;
  leftovers: LeftoverPreference;
  /** Longest total cook time that suits a normal weeknight, in minutes. */
  maxCookMinutes: number;
}

export interface Preferences {
  likedProteins: Protein[];
  dislikedProteins: Protein[];
  likedCuisines: Cuisine[];
  dislikedCuisines: Cuisine[];
  /** Hard exclusions: a recipe containing one is never recommended. */
  excludedIngredients: string[];
  dietary: DietaryTag[];
}

export interface PlannedMeal {
  id: string;
  day: string;
  recipeId: string | null;
  locked: boolean;
  /** Per-meal headcount. `null` means "however many the household is". */
  dinersOverride: number | null;
  /** Extra servings deliberately cooked for later, on top of the diners. */
  extraServings: number;
  cooked: boolean;
}

export interface WeekPlan {
  weekOf: string;
  seed: number;
  meals: PlannedMeal[];
}

export interface PantryItem {
  ingredientId: string;
  /** Undefined means "always on hand" — the usual case for salt or oil. */
  qty?: number;
  unit?: Unit;
}

export interface CookedMeal {
  recipeId: string;
  /** ISO date, day precision. */
  date: string;
  diners: number;
  rating?: Rating;
}

export interface CustomGroceryItem {
  id: string;
  name: string;
  category: Category;
  note?: string;
}

export interface GroceryState {
  /** Keys of ticked-off list rows. */
  checked: string[];
  /** Rows dismissed for this week ("we already have it"). */
  removed: string[];
  custom: CustomGroceryItem[];
}

export interface HomeCookData {
  version: number;
  createdAt: number;
  updatedAt: number;
  household: Household;
  settings: Settings;
  preferences: Preferences;
  plan: WeekPlan;
  pantry: PantryItem[];
  ratings: Record<string, Rating>;
  history: CookedMeal[];
  /** Recipes brought in from HelloFresh menus or entered by hand. */
  imported: Recipe[];
  /** Ingredients invented by an import because the catalogue lacked them. */
  customIngredients: Ingredient[];
  grocery: GroceryState;
  onboarded: boolean;
}
