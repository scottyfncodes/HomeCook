/**
 * The consolidated grocery list.
 *
 * It is always derived from the current week — swap a meal or change a
 * headcount and the list is rebuilt, never patched. The pantry is subtracted
 * before anything is bought, and package maths happens last, because the shop
 * sells packs rather than the 2.4 lb the recipes actually need.
 */
import type {
  Category,
  HomeCookData,
  PantryItem,
  Unit,
} from '@homecook/core/types';
import { CATEGORY_ORDER } from '@homecook/core/types';
import { getIngredient } from '@homecook/data/ingredients';
import { getStore } from '@homecook/data/stores';
import { packagesFor, round2, toCanonical } from '@homecook/engine/pricing';
import { resolveWeek } from '@homecook/engine/plan';
import { scaleIngredients } from '@homecook/engine/scale';
import { convert } from '@homecook/engine/units';

export interface GroceryLine {
  key: string;
  kind: 'ingredient' | 'custom';
  ingredientId?: string;
  name: string;
  category: Category;
  unit: Unit;
  /** Everything the week's cooking needs, in the ingredient's unit. */
  needQty: number;
  /** How much of that the pantry already covers. */
  fromPantry: number;
  buyQty: number;
  packages: number;
  packageLabel: string;
  purchasedQty: number;
  /** Product left over once the week is cooked. */
  surplus: number;
  cost: number;
  priced: boolean;
  meals: string[];
  checked: boolean;
  coveredBy?: 'pantry' | 'dismissed';
}

export interface GrocerySection {
  category: Category;
  lines: GroceryLine[];
}

export interface GroceryList {
  sections: GrocerySection[];
  /** Rows not being bought: covered by the pantry, or dismissed by hand. */
  covered: GroceryLine[];
  /** Estimated basket total, whole packages, at the chosen store. */
  total: number;
  itemCount: number;
  checkedCount: number;
  /** Rows HomeCook has no price for — excluded from the total. */
  unpricedItems: number;
}

function pantryCoverage(pantry: PantryItem[], ingredientId: string, unit: Unit, need: number): number {
  const entry = pantry.find((p) => p.ingredientId === ingredientId);
  if (!entry) return 0;
  // No quantity recorded means "we always have this" — salt, oil, spices.
  if (entry.qty === undefined || entry.unit === undefined) return need;
  const have = convert(entry.qty, entry.unit, unit);
  if (have === null) return 0;
  return Math.max(0, Math.min(need, have));
}

export function buildGroceryList(data: HomeCookData): GroceryList {
  const storeFactor = getStore(data.settings.storeId).factor;
  const totals = new Map<string, { qty: number; meals: Set<string> }>();

  for (const resolved of resolveWeek(data)) {
    if (!resolved.recipe) continue;
    for (const item of scaleIngredients(resolved.recipe, resolved.servings)) {
      const ingredient = getIngredient(item.ingredientId);
      if (!ingredient) continue;
      const qty = toCanonical(ingredient, item.qty, item.unit);
      if (qty === null) continue;
      const entry = totals.get(ingredient.id) ?? { qty: 0, meals: new Set<string>() };
      entry.qty += qty;
      entry.meals.add(resolved.recipe.name);
      totals.set(ingredient.id, entry);
    }
  }

  const checked = new Set(data.grocery.checked);
  const dismissed = new Set(data.grocery.removed);
  const buy: GroceryLine[] = [];
  const covered: GroceryLine[] = [];

  for (const [ingredientId, entry] of totals) {
    const ingredient = getIngredient(ingredientId)!;
    const needQty = round2(entry.qty);
    const fromPantry = round2(pantryCoverage(data.pantry, ingredientId, ingredient.unit, needQty));
    const buyQty = round2(Math.max(0, needQty - fromPantry));
    const priced = ingredient.priced !== false;
    const math = priced && buyQty > 0
      ? packagesFor(ingredient, buyQty, storeFactor)
      : { packages: 0, purchasedQty: 0, cost: 0, surplus: 0 };

    const line: GroceryLine = {
      key: ingredientId,
      kind: 'ingredient',
      ingredientId,
      name: ingredient.name,
      category: ingredient.category,
      unit: ingredient.unit,
      needQty,
      fromPantry,
      buyQty,
      packages: math.packages,
      packageLabel: ingredient.pkg.label ?? '1 pack',
      purchasedQty: math.purchasedQty,
      surplus: math.surplus,
      cost: math.cost,
      priced,
      meals: [...entry.meals],
      checked: checked.has(ingredientId),
    };

    if (buyQty <= 0.001) {
      covered.push({ ...line, coveredBy: 'pantry' });
    } else if (dismissed.has(ingredientId)) {
      covered.push({ ...line, coveredBy: 'dismissed', cost: 0, packages: 0 });
    } else {
      buy.push(line);
    }
  }

  for (const custom of data.grocery.custom) {
    buy.push({
      key: custom.id,
      kind: 'custom',
      name: custom.name,
      category: custom.category,
      unit: 'count',
      needQty: 0,
      fromPantry: 0,
      buyQty: 0,
      packages: 0,
      packageLabel: custom.note ?? 'added by you',
      purchasedQty: 0,
      surplus: 0,
      cost: 0,
      priced: false,
      meals: [],
      checked: checked.has(custom.id),
    });
  }

  const sections: GrocerySection[] = CATEGORY_ORDER.map((category) => ({
    category,
    lines: buy
      .filter((l) => l.category === category)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((s) => s.lines.length > 0);

  return {
    sections,
    covered: covered.sort((a, b) => a.name.localeCompare(b.name)),
    total: round2(buy.reduce((sum, l) => sum + l.cost, 0)),
    itemCount: buy.length,
    checkedCount: buy.filter((l) => l.checked).length,
    unpricedItems: buy.filter((l) => !l.priced).length,
  };
}

export interface BudgetStatus {
  budget: number;
  spent: number;
  remaining: number;
  /** 0–1, clamped, for the progress bar. */
  fraction: number;
  over: boolean;
}

export function budgetStatus(budget: number, spent: number): BudgetStatus {
  const remaining = round2(budget - spent);
  return {
    budget,
    spent: round2(spent),
    remaining,
    fraction: budget > 0 ? Math.min(1, spent / budget) : 0,
    over: remaining < 0,
  };
}
