/**
 * Ingredient catalogue: what things are, how they are sold, and roughly what
 * they cost. Prices are deliberately *estimates* — a baseline shelf price that
 * the store layer adjusts — and never presented as a checkout total.
 *
 * Adding an ingredient is a one-line job on purpose; a real price feed would
 * replace `pkg.price` here without touching the planner.
 */
import type { Category, Ingredient, PackageSpec, Unit } from '@homecook/core/types';

function ing(
  id: string,
  name: string,
  category: Category,
  unit: Unit,
  pkg: [size: number, unit: Unit, price: number, label: string],
  opts: { staple?: boolean; aliases?: string[]; gramsPerCup?: number } = {},
): Ingredient {
  const spec: PackageSpec = { size: pkg[0], unit: pkg[1], price: pkg[2], label: pkg[3] };
  return { id, name, category, unit, pkg: spec, priced: true, ...opts };
}

export const INGREDIENTS: Ingredient[] = [
  // ---- Meat & seafood ----
  ing('chicken_breast', 'Chicken breast', 'meat', 'lb', [1.5, 'lb', 8.24, '1.5 lb pack'], {
    aliases: ['boneless skinless chicken breasts', 'chicken breasts', 'chicken cutlets'],
  }),
  ing('chicken_thigh', 'Chicken thighs', 'meat', 'lb', [1.5, 'lb', 6.29, '1.5 lb pack'], {
    aliases: ['boneless skinless chicken thighs', 'chicken thigh'],
  }),
  ing('ground_beef', 'Ground beef', 'meat', 'lb', [1, 'lb', 6.49, '1 lb pack'], {
    aliases: ['ground beef 85%', 'lean ground beef'],
  }),
  ing('sirloin', 'Sirloin steak', 'meat', 'lb', [1, 'lb', 10.99, '1 lb pack'], {
    aliases: ['beef sirloin', 'steak strips', 'flank steak'],
  }),
  ing('ground_turkey', 'Ground turkey', 'meat', 'lb', [1, 'lb', 5.79, '1 lb pack']),
  ing('ground_pork', 'Ground pork', 'meat', 'lb', [1, 'lb', 5.49, '1 lb pack']),
  ing('pork_chop', 'Pork chops', 'meat', 'lb', [1.25, 'lb', 6.99, '1.25 lb pack'], {
    aliases: ['boneless pork chops'],
  }),
  ing('pork_tenderloin', 'Pork tenderloin', 'meat', 'lb', [1.25, 'lb', 8.49, '1.25 lb pack']),
  ing('italian_sausage', 'Italian sausage', 'meat', 'lb', [1, 'lb', 5.99, '1 lb pack'], {
    aliases: ['pork sausage', 'sausage links', 'chicken sausage'],
  }),
  ing('chorizo', 'Chorizo', 'meat', 'lb', [1, 'lb', 6.49, '1 lb pack']),
  ing('bacon', 'Bacon', 'meat', 'oz', [12, 'oz', 6.49, '12 oz pack'], { gramsPerCup: 120 }),
  ing('shrimp', 'Shrimp', 'meat', 'lb', [1, 'lb', 11.99, '1 lb bag'], {
    aliases: ['peeled shrimp', 'raw shrimp'],
  }),
  ing('salmon', 'Salmon fillets', 'meat', 'lb', [1, 'lb', 13.99, '1 lb pack'], {
    aliases: ['salmon fillet'],
  }),
  ing('cod', 'Cod fillets', 'meat', 'lb', [1, 'lb', 11.49, '1 lb pack'], {
    aliases: ['white fish', 'tilapia'],
  }),

  // ---- Produce ----
  ing('onion', 'Yellow onion', 'produce', 'count', [3, 'count', 2.49, '3-pack'], {
    aliases: ['yellow onions', 'onions'],
  }),
  ing('red_onion', 'Red onion', 'produce', 'count', [2, 'count', 2.29, '2-pack']),
  ing('shallot', 'Shallot', 'produce', 'count', [3, 'count', 2.49, '3-pack']),
  ing('garlic', 'Garlic', 'produce', 'clove', [10, 'clove', 0.89, '1 head'], {
    aliases: ['garlic cloves', 'minced garlic'],
  }),
  ing('ginger', 'Fresh ginger', 'produce', 'tbsp', [8, 'tbsp', 1.29, '1 knob'], {
    aliases: ['ginger root'],
  }),
  ing('bell_pepper', 'Bell pepper', 'produce', 'count', [3, 'count', 3.99, '3-pack'], {
    aliases: ['red bell pepper', 'green bell pepper', 'peppers'],
  }),
  ing('jalapeno', 'Jalapeño', 'produce', 'count', [4, 'count', 1.29, '4-pack'], {
    aliases: ['jalapenos', 'chili pepper'],
  }),
  ing('lime', 'Lime', 'produce', 'count', [4, 'count', 1.99, '4-pack'], { aliases: ['limes'] }),
  ing('lemon', 'Lemon', 'produce', 'count', [4, 'count', 2.49, '4-pack'], { aliases: ['lemons'] }),
  ing('tomato', 'Roma tomato', 'produce', 'count', [4, 'count', 2.79, '4-pack'], {
    aliases: ['tomatoes', 'roma tomatoes'],
  }),
  ing('cherry_tomato', 'Cherry tomatoes', 'produce', 'oz', [10, 'oz', 3.49, '10 oz box'], { gramsPerCup: 150, aliases: ['grape tomatoes'],
  }),
  ing('potato', 'Russet potatoes', 'produce', 'lb', [5, 'lb', 4.99, '5 lb bag'], {
    aliases: ['potatoes', 'yukon potatoes', 'baby potatoes'],
  }),
  ing('sweet_potato', 'Sweet potato', 'produce', 'count', [3, 'count', 3.29, '3-pack']),
  ing('carrot', 'Carrots', 'produce', 'count', [8, 'count', 2.29, '1 lb bag']),
  ing('celery', 'Celery', 'produce', 'count', [8, 'count', 2.49, '1 bunch']),
  ing('zucchini', 'Zucchini', 'produce', 'count', [2, 'count', 2.29, '2-pack']),
  ing('broccoli', 'Broccoli', 'produce', 'lb', [1, 'lb', 2.69, '1 lb'], { gramsPerCup: 90 }),
  ing('green_beans', 'Green beans', 'produce', 'lb', [1, 'lb', 2.99, '1 lb bag'], { gramsPerCup: 110 }),
  ing('asparagus', 'Asparagus', 'produce', 'lb', [1, 'lb', 3.99, '1 lb bunch']),
  ing('spinach', 'Baby spinach', 'produce', 'oz', [5, 'oz', 3.29, '5 oz box'], { gramsPerCup: 30, aliases: ['spinach leaves'],
  }),
  ing('kale', 'Kale', 'produce', 'bunch', [1, 'bunch', 2.49, '1 bunch']),
  ing('mixed_greens', 'Mixed greens', 'produce', 'oz', [5, 'oz', 3.99, '5 oz box'], { gramsPerCup: 30, aliases: ['spring mix', 'salad greens', 'arugula'],
  }),
  ing('romaine', 'Romaine lettuce', 'produce', 'count', [3, 'count', 3.99, '3 hearts'], {
    aliases: ['lettuce'],
  }),
  ing('cucumber', 'Cucumber', 'produce', 'count', [2, 'count', 1.98, '2-pack'], {
    aliases: ['persian cucumbers'],
  }),
  ing('cabbage', 'Green cabbage', 'produce', 'count', [1, 'count', 2.79, '1 head'], {
    aliases: ['slaw mix', 'coleslaw mix'],
  }),
  ing('mushroom', 'Cremini mushrooms', 'produce', 'oz', [8, 'oz', 2.99, '8 oz box'], { gramsPerCup: 70, aliases: ['mushrooms', 'button mushrooms'],
  }),
  ing('scallion', 'Scallions', 'produce', 'bunch', [1, 'bunch', 1.29, '1 bunch'], {
    aliases: ['green onions', 'spring onions'],
  }),
  ing('cilantro', 'Cilantro', 'produce', 'bunch', [1, 'bunch', 1.29, '1 bunch']),
  ing('parsley', 'Parsley', 'produce', 'bunch', [1, 'bunch', 1.29, '1 bunch'], {
    aliases: ['flat leaf parsley'],
  }),
  ing('basil', 'Fresh basil', 'produce', 'bunch', [1, 'bunch', 2.99, '1 package']),
  ing('thyme', 'Fresh thyme', 'produce', 'bunch', [1, 'bunch', 2.49, '1 package']),
  ing('rosemary', 'Fresh rosemary', 'produce', 'bunch', [1, 'bunch', 2.49, '1 package']),
  ing('avocado', 'Avocado', 'produce', 'count', [2, 'count', 2.98, '2-pack']),
  ing('snap_peas', 'Sugar snap peas', 'produce', 'oz', [8, 'oz', 3.49, '8 oz bag'], { gramsPerCup: 63 }),

  // ---- Dairy ----
  ing('butter', 'Butter', 'dairy', 'tbsp', [32, 'tbsp', 4.99, '1 lb (4 sticks)'], { staple: true }),
  ing('milk', 'Milk', 'dairy', 'cup', [8, 'cup', 2.99, 'half gallon'], { staple: true }),
  ing('heavy_cream', 'Heavy cream', 'dairy', 'cup', [2, 'cup', 3.99, '1 pint'], {
    aliases: ['cream'],
  }),
  ing('sour_cream', 'Sour cream', 'dairy', 'cup', [2, 'cup', 2.79, '16 oz tub']),
  ing('cream_cheese', 'Cream cheese', 'dairy', 'oz', [8, 'oz', 2.99, '8 oz block']),
  ing('parmesan', 'Parmesan', 'dairy', 'oz', [8, 'oz', 5.49, '8 oz wedge'], { gramsPerCup: 100, aliases: ['parmesan cheese', 'grated parmesan'],
  }),
  ing('mozzarella', 'Mozzarella', 'dairy', 'oz', [8, 'oz', 3.49, '8 oz bag'], { gramsPerCup: 113, aliases: ['shredded mozzarella'],
  }),
  ing('cheddar', 'Cheddar', 'dairy', 'oz', [8, 'oz', 3.29, '8 oz bag'], { gramsPerCup: 113, aliases: ['shredded cheddar', 'monterey jack', 'mexican cheese blend'],
  }),
  ing('feta', 'Feta', 'dairy', 'oz', [6, 'oz', 3.49, '6 oz block'], { gramsPerCup: 150 }),
  ing('greek_yogurt', 'Greek yogurt', 'dairy', 'cup', [4, 'cup', 4.49, '32 oz tub']),
  ing('egg', 'Eggs', 'dairy', 'count', [12, 'count', 3.99, '1 dozen'], { staple: true }),

  // ---- Bakery ----
  ing('flour_tortilla', 'Flour tortillas', 'bakery', 'count', [10, 'count', 3.29, '10-pack']),
  ing('corn_tortilla', 'Corn tortillas', 'bakery', 'count', [12, 'count', 2.49, '12-pack']),
  ing('burger_bun', 'Burger buns', 'bakery', 'count', [8, 'count', 3.49, '8-pack'], {
    aliases: ['brioche buns', 'potato buns'],
  }),
  ing('ciabatta', 'Ciabatta rolls', 'bakery', 'count', [4, 'count', 3.99, '4-pack'], {
    aliases: ['baguette', 'sub rolls'],
  }),
  ing('sandwich_bread', 'Sandwich bread', 'bakery', 'slice', [20, 'slice', 3.49, '1 loaf']),
  ing('naan', 'Naan', 'bakery', 'count', [4, 'count', 3.99, '4-pack'], { aliases: ['flatbread'] }),

  // ---- Pantry ----
  ing('olive_oil', 'Olive oil', 'pantry', 'tbsp', [34, 'tbsp', 9.49, '17 oz bottle'], { staple: true }),
  ing('vegetable_oil', 'Vegetable oil', 'pantry', 'tbsp', [64, 'tbsp', 4.29, '32 oz bottle'], {
    staple: true,
    aliases: ['canola oil', 'cooking oil'],
  }),
  ing('sesame_oil', 'Sesame oil', 'pantry', 'tbsp', [10, 'tbsp', 4.29, '5 oz bottle'], { staple: true }),
  ing('salt', 'Salt', 'pantry', 'tsp', [200, 'tsp', 1.49, '1 box'], { staple: true, aliases: ['kosher salt'] }),
  ing('pepper', 'Black pepper', 'pantry', 'tsp', [60, 'tsp', 3.49, '1 jar'], { staple: true, aliases: ['black pepper'] }),
  ing('garlic_powder', 'Garlic powder', 'pantry', 'tsp', [40, 'tsp', 2.99, '1 jar'], { staple: true }),
  ing('onion_powder', 'Onion powder', 'pantry', 'tsp', [40, 'tsp', 2.99, '1 jar'], { staple: true }),
  ing('paprika', 'Paprika', 'pantry', 'tsp', [40, 'tsp', 3.29, '1 jar'], { staple: true }),
  ing('smoked_paprika', 'Smoked paprika', 'pantry', 'tsp', [36, 'tsp', 3.79, '1 jar'], { staple: true }),
  ing('cumin', 'Cumin', 'pantry', 'tsp', [40, 'tsp', 3.29, '1 jar'], { staple: true }),
  ing('chili_powder', 'Chili powder', 'pantry', 'tsp', [40, 'tsp', 3.29, '1 jar'], { staple: true }),
  ing('italian_seasoning', 'Italian seasoning', 'pantry', 'tsp', [36, 'tsp', 3.29, '1 jar'], { staple: true }),
  ing('oregano', 'Dried oregano', 'pantry', 'tsp', [36, 'tsp', 2.99, '1 jar'], { staple: true }),
  ing('chili_flakes', 'Red pepper flakes', 'pantry', 'tsp', [30, 'tsp', 2.99, '1 jar'], { staple: true }),
  ing('curry_powder', 'Curry powder', 'pantry', 'tsp', [36, 'tsp', 3.49, '1 jar'], { staple: true }),
  ing('garam_masala', 'Garam masala', 'pantry', 'tsp', [30, 'tsp', 4.29, '1 jar'], { staple: true }),
  ing('soy_sauce', 'Soy sauce', 'pantry', 'tbsp', [30, 'tbsp', 3.49, '15 oz bottle'], { staple: true }),
  ing('hot_sauce', 'Hot sauce', 'pantry', 'tbsp', [24, 'tbsp', 3.29, '12 oz bottle'], { staple: true }),
  ing('sriracha', 'Sriracha', 'pantry', 'tbsp', [34, 'tbsp', 4.49, '17 oz bottle'], { staple: true }),
  ing('gochujang', 'Gochujang', 'pantry', 'tbsp', [30, 'tbsp', 5.49, '1 tub']),
  ing('rice_vinegar', 'Rice vinegar', 'pantry', 'tbsp', [24, 'tbsp', 2.99, '12 oz bottle'], { staple: true }),
  ing('balsamic', 'Balsamic vinegar', 'pantry', 'tbsp', [32, 'tbsp', 4.49, '16 oz bottle'], { staple: true }),
  ing('honey', 'Honey', 'pantry', 'tbsp', [24, 'tbsp', 5.49, '12 oz bottle'], { staple: true }),
  ing('brown_sugar', 'Brown sugar', 'pantry', 'cup', [4, 'cup', 2.79, '1 lb bag'], { staple: true }),
  ing('sugar', 'Sugar', 'pantry', 'cup', [9, 'cup', 3.99, '4 lb bag'], { staple: true }),
  ing('flour', 'Flour', 'pantry', 'cup', [17, 'cup', 3.49, '5 lb bag'], { staple: true }),
  ing('cornstarch', 'Cornstarch', 'pantry', 'tbsp', [32, 'tbsp', 2.29, '1 box'], { staple: true }),
  ing('rice', 'Jasmine rice', 'pantry', 'cup', [10, 'cup', 5.49, '2 lb bag'], {
    staple: true,
    aliases: ['white rice', 'basmati rice'],
  }),
  ing('quinoa', 'Quinoa', 'pantry', 'cup', [6, 'cup', 5.99, '1 lb bag'], { gramsPerCup: 170 }),
  ing('penne', 'Penne', 'pantry', 'oz', [16, 'oz', 1.99, '1 lb box'], { gramsPerCup: 105, aliases: ['rigatoni', 'ziti', 'short pasta'],
  }),
  ing('spaghetti', 'Spaghetti', 'pantry', 'oz', [16, 'oz', 1.99, '1 lb box'], { gramsPerCup: 105, aliases: ['linguine', 'fettuccine'],
  }),
  ing('orzo', 'Orzo', 'pantry', 'oz', [16, 'oz', 2.49, '1 lb box'], { gramsPerCup: 200 }),
  ing('panko', 'Panko breadcrumbs', 'pantry', 'cup', [8, 'cup', 2.99, '8 oz box'], { gramsPerCup: 60, aliases: ['breadcrumbs'],
  }),
  ing('broth', 'Chicken broth', 'pantry', 'cup', [4, 'cup', 2.99, '32 oz carton'], {
    staple: true,
    aliases: ['stock', 'vegetable broth', 'beef broth'],
  }),
  ing('coconut_milk', 'Coconut milk', 'pantry', 'can', [1, 'can', 2.29, '13.5 oz can']),
  ing('diced_tomatoes', 'Diced tomatoes', 'pantry', 'can', [1, 'can', 1.79, '14.5 oz can'], {
    aliases: ['canned tomatoes', 'crushed tomatoes'],
  }),
  ing('tomato_paste', 'Tomato paste', 'pantry', 'tbsp', [12, 'tbsp', 1.29, '6 oz can']),
  ing('marinara', 'Marinara sauce', 'pantry', 'cup', [3, 'cup', 3.49, '24 oz jar'], {
    aliases: ['pasta sauce', 'tomato sauce'],
  }),
  ing('black_beans', 'Black beans', 'pantry', 'can', [1, 'can', 1.29, '15 oz can']),
  ing('chickpeas', 'Chickpeas', 'pantry', 'can', [1, 'can', 1.29, '15 oz can'], {
    aliases: ['garbanzo beans'],
  }),
  ing('lentils', 'Lentils', 'pantry', 'cup', [5, 'cup', 3.29, '1 lb bag'], { gramsPerCup: 200 }),
  ing('salsa', 'Salsa', 'pantry', 'cup', [2, 'cup', 3.29, '16 oz jar']),
  ing('mayo', 'Mayonnaise', 'pantry', 'tbsp', [30, 'tbsp', 4.99, '30 oz jar'], { staple: true }),
  ing('dijon', 'Dijon mustard', 'pantry', 'tbsp', [16, 'tbsp', 3.29, '8 oz jar'], { staple: true }),
  ing('pesto', 'Pesto', 'pantry', 'tbsp', [14, 'tbsp', 4.29, '7 oz jar']),
  ing('sun_dried_tomato', 'Sun-dried tomatoes', 'pantry', 'oz', [8, 'oz', 4.49, '8 oz jar'], { gramsPerCup: 110 }),
  ing('peanut_butter', 'Peanut butter', 'pantry', 'tbsp', [32, 'tbsp', 4.29, '16 oz jar'], { staple: true }),
  ing('sesame_seeds', 'Sesame seeds', 'pantry', 'tsp', [30, 'tsp', 3.29, '1 jar'], { staple: true }),

  // ---- Frozen ----
  ing('frozen_peas', 'Frozen peas', 'frozen', 'cup', [4, 'cup', 2.29, '16 oz bag'], { staple: true }),
  ing('frozen_corn', 'Frozen corn', 'frozen', 'cup', [4, 'cup', 2.29, '16 oz bag'], { staple: true }),
  ing('frozen_edamame', 'Frozen edamame', 'frozen', 'cup', [4, 'cup', 3.29, '14 oz bag']),
];

export const INGREDIENT_BY_ID: Map<string, Ingredient> = new Map(
  INGREDIENTS.map((i) => [i.id, i]),
);

/**
 * Imported recipes can mention things the catalogue has never heard of. Those
 * are registered here as ad-hoc ingredients with `priced: false`, so the rest
 * of the app can treat them normally while the UI stays honest about not
 * knowing what they cost.
 */
const CUSTOM = new Map<string, Ingredient>();

export function registerCustomIngredients(items: Ingredient[]): void {
  for (const item of items) CUSTOM.set(item.id, item);
}

export function clearCustomIngredients(): void {
  CUSTOM.clear();
}

export function customIngredients(): Ingredient[] {
  return [...CUSTOM.values()];
}

export function getIngredient(id: string): Ingredient | undefined {
  return INGREDIENT_BY_ID.get(id) ?? CUSTOM.get(id);
}

/** Staples offered as one-tap fill on the pantry screen. */
export const STAPLE_IDS: string[] = INGREDIENTS.filter((i) => i.staple).map((i) => i.id);

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Best-effort text → ingredient match, used when importing recipes. Exact name
 * and alias matches win; otherwise the longest catalogue name contained in the
 * text does, so "boneless chicken thighs, diced" finds chicken thighs.
 */
export function matchIngredient(text: string): Ingredient | undefined {
  const t = normalise(text);
  if (!t) return undefined;

  let best: Ingredient | undefined;
  let bestLen = 0;
  for (const item of [...INGREDIENTS, ...CUSTOM.values()]) {
    const names = [item.name, ...(item.aliases ?? [])].map(normalise);
    for (const name of names) {
      if (!name) continue;
      if (t === name) return item;
      const hit = t.includes(name) || (name.length > 5 && name.includes(t));
      if (hit && name.length > bestLen) {
        best = item;
        bestLen = name.length;
      }
    }
  }
  return best;
}
