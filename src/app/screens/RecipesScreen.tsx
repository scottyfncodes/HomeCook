import { useMemo, useState } from 'react';
import type { Cuisine, HomeCookData, Protein, Recipe } from '@homecook/core/types';
import { RATINGS, RATING_LABEL } from '@homecook/core/types';
import { rateRecipe, removeImportedRecipe, setMealRecipe } from '@homecook/core/actions';
import { apply } from '@homecook/app/useHomeCook';
import { allRecipes } from '@homecook/engine/library';
import { exclusionFor } from '@homecook/engine/constraints';
import { householdSize } from '@homecook/engine/plan';
import { estimateMealCost } from '@homecook/engine/pricing';
import { planServings, scaledTime } from '@homecook/engine/scale';
import { getStore } from '@homecook/data/stores';
import { formatMinutes, formatMoney } from '@homecook/engine/units';
import { IngredientList } from '@homecook/app/components/IngredientList';
import { CookMode } from '@homecook/app/components/CookMode';
import { DishArt } from '@homecook/app/components/DishArt';
import { Btn, Chip, EmptyState, Sheet } from '@homecook/app/components/ui';

const PROTEIN_FILTERS: Protein[] = ['chicken', 'beef', 'pork', 'sausage', 'seafood', 'turkey', 'vegetarian'];
const TIME_LIMITS = [30, 45, 60];

export function RecipesScreen({ data }: { data: HomeCookData }) {
  const [query, setQuery] = useState('');
  const [protein, setProtein] = useState<Protein | null>(null);
  const [cuisine, setCuisine] = useState<Cuisine | null>(null);
  const [maxTime, setMaxTime] = useState<number | null>(null);
  const [open, setOpen] = useState<Recipe | null>(null);
  const [cooking, setCooking] = useState<{ recipe: Recipe; servings: number } | null>(null);

  const size = householdSize(data.household);
  const library = useMemo(() => allRecipes(data), [data]);
  const cuisines = useMemo(
    () => [...new Set(library.map((recipe) => recipe.cuisine))].sort(),
    [library],
  );

  const recipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return library
      .filter((recipe) => (protein ? recipe.protein === protein : true))
      .filter((recipe) => (cuisine ? recipe.cuisine === cuisine : true))
      .filter((recipe) =>
        maxTime
          ? scaledTime(recipe, planServings(recipe, size, data.settings.leftovers).servings) <= maxTime
          : true,
      )
      .filter((recipe) =>
        q
          ? recipe.name.toLowerCase().includes(q) ||
            recipe.cuisine.includes(q) ||
            recipe.flavorTags.some((tag) => tag.includes(q))
          : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [library, protein, cuisine, maxTime, query, size, data.settings.leftovers]);

  return (
    <section className="screen">
      <header className="screen__head">
        <div>
          <h1>Recipes</h1>
          <p className="screen__sub">
            {library.length} in your library · {data.imported.length} imported
          </p>
        </div>
      </header>

      <input
        className="input"
        placeholder="Search recipes…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="chiprow">
        <Chip active={protein === null} onClick={() => setProtein(null)}>
          All
        </Chip>
        {PROTEIN_FILTERS.map((item) => (
          <Chip key={item} active={protein === item} onClick={() => setProtein(protein === item ? null : item)}>
            {item}
          </Chip>
        ))}
      </div>

      <div className="filters">
        <label className="filters__field">
          <span>Time</span>
          <select
            className="input input--select"
            value={maxTime ?? ''}
            onChange={(event) => setMaxTime(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">Any length</option>
            {TIME_LIMITS.map((limit) => (
              <option key={limit} value={limit}>
                {limit} min or less
              </option>
            ))}
          </select>
        </label>
        <label className="filters__field">
          <span>Cuisine</span>
          <select
            className="input input--select"
            value={cuisine ?? ''}
            onChange={(event) => setCuisine((event.target.value || null) as Cuisine | null)}
          >
            <option value="">All cuisines</option>
            {cuisines.map((item) => (
              <option key={item} value={item}>
                {item[0]!.toUpperCase() + item.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(protein || cuisine || maxTime || query) && (
        <p className="screen__sub">
          {recipes.length} of {library.length} match
        </p>
      )}

      {recipes.length === 0 ? (
        <EmptyState title="No matches" body="Try a different search or clear a filter." />
      ) : (
        <ul className="rlist">
          {recipes.map((recipe) => {
            const serving = planServings(recipe, size, data.settings.leftovers);
            const excluded = exclusionFor(recipe, data);
            const rating = data.ratings[recipe.id];
            return (
              <li key={recipe.id}>
                <button type="button" className="ritem" onClick={() => setOpen(recipe)}>
                  <DishArt format={recipe.format} size={40} />
                  <span className="ritem__text">
                    <strong>{recipe.name}</strong>
                    <span className="ritem__meta">
                      {recipe.cuisine} · {formatMinutes(scaledTime(recipe, serving.servings))} ·{' '}
                      {formatMoney(estimateMealCost(recipe, serving.servings, getStore(data.settings.storeId).factor))}
                      {rating ? ` · ${RATING_LABEL[rating]}` : ''}
                    </span>
                    {recipe.source === 'imported' && (
                      <span className="ritem__badge">
                        {recipe.planReady ? 'imported' : 'imported · taste reference only'}
                      </span>
                    )}
                    {excluded && <span className="ritem__excluded">{excluded}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <RecipeSheet
          data={data}
          recipe={open}
          onClose={() => setOpen(null)}
          onCook={(servings) => {
            setCooking({ recipe: open, servings });
            setOpen(null);
          }}
        />
      )}
      {cooking && (
        <CookMode
          recipe={cooking.recipe}
          servings={cooking.servings}
          onClose={() => setCooking(null)}
          onFinish={(rating) => {
            if (rating) apply((current) => rateRecipe(current, cooking.recipe.id, rating));
            setCooking(null);
          }}
        />
      )}
    </section>
  );
}

function RecipeSheet({
  data,
  recipe,
  onClose,
  onCook,
}: {
  data: HomeCookData;
  recipe: Recipe;
  onClose: () => void;
  onCook: (servings: number) => void;
}) {
  const size = householdSize(data.household);
  const [servings, setServings] = useState(() => planServings(recipe, size, data.settings.leftovers).servings);
  const cost = estimateMealCost(recipe, servings, getStore(data.settings.storeId).factor);
  const excluded = exclusionFor(recipe, data);
  const rating = data.ratings[recipe.id];

  return (
    <Sheet open title={recipe.name} onClose={onClose}>
      <p className="sheet__lede">{recipe.description}</p>

      <div className="chiprow">
        <Chip>{recipe.cuisine}</Chip>
        <Chip>{recipe.protein}</Chip>
        <Chip>{recipe.format}</Chip>
        {recipe.flavorTags.map((tag) => (
          <Chip key={tag}>{tag}</Chip>
        ))}
      </div>

      {excluded && <p className="warnbox">Excluded from planning: {excluded}</p>}
      {recipe.source === 'imported' && recipe.planReady === false && (
        <p className="warnbox">
          Too much of this one didn't resolve to known ingredients, so HomeCook won't plan meals from
          it. It still counts towards your taste profile.
        </p>
      )}

      <div className="servings">
        <button type="button" onClick={() => setServings(Math.max(1, servings - 1))} aria-label="Fewer servings">
          −
        </button>
        <span>
          <strong>{servings}</strong> servings
        </span>
        <button type="button" onClick={() => setServings(Math.min(40, servings + 1))} aria-label="More servings">
          +
        </button>
      </div>
      <p className="fineprint">
        Written for {recipe.servings}; quantities below are scaled. About {formatMoney(cost)} of
        ingredients, {formatMinutes(scaledTime(recipe, servings))}.
      </p>
      {recipe.steps.length > 0 && (
        <Btn variant="primary" wide onClick={() => onCook(servings)}>
          Cook {servings} servings now
        </Btn>
      )}

      <h3 className="sheet__h3">Ingredients</h3>
      <IngredientList recipe={recipe} servings={servings} />

      {recipe.steps.length > 0 && (
        <>
          <h3 className="sheet__h3">Method</h3>
          <ol className="steps">
            {recipe.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </>
      )}

      <h3 className="sheet__h3">What did you think?</h3>
      <div className="ratings">
        {RATINGS.map((value) => (
          <button
            key={value}
            type="button"
            className={`rating ${rating === value ? 'rating--on' : ''}`}
            onClick={() => apply((current) => rateRecipe(current, recipe.id, rating === value ? null : value))}
          >
            {RATING_LABEL[value]}
          </button>
        ))}
      </div>

      {recipe.planReady !== false && (
        <>
          <h3 className="sheet__h3">Put it on a day</h3>
          <div className="chiprow">
            {data.plan.meals.map((meal) => (
              <Chip
                key={meal.id}
                onClick={() => {
                  apply((current) => setMealRecipe(current, meal.id, recipe.id));
                  onClose();
                }}
              >
                {meal.day}
              </Chip>
            ))}
          </div>
        </>
      )}

      {recipe.source === 'imported' && (
        <Btn
          variant="danger"
          wide
          onClick={() => {
            apply((current) => removeImportedRecipe(current, recipe.id));
            onClose();
          }}
        >
          Remove from library
        </Btn>
      )}
    </Sheet>
  );
}
