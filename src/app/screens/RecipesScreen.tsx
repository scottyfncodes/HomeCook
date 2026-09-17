import { useMemo, useState } from 'react';
import type { HomeCookData, Protein, Recipe } from '@homecook/core/types';
import { RATINGS, RATING_EMOJI, RATING_LABEL } from '@homecook/core/types';
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
import { Btn, Chip, EmptyState, Sheet } from '@homecook/app/components/ui';

const PROTEIN_FILTERS: Protein[] = ['chicken', 'beef', 'pork', 'sausage', 'seafood', 'turkey', 'vegetarian'];

export function RecipesScreen({ data }: { data: HomeCookData }) {
  const [query, setQuery] = useState('');
  const [protein, setProtein] = useState<Protein | null>(null);
  const [open, setOpen] = useState<Recipe | null>(null);

  const recipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRecipes(data)
      .filter((recipe) => (protein ? recipe.protein === protein : true))
      .filter((recipe) =>
        q
          ? recipe.name.toLowerCase().includes(q) ||
            recipe.cuisine.includes(q) ||
            recipe.flavorTags.some((tag) => tag.includes(q))
          : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, protein, query]);

  const size = householdSize(data.household);

  return (
    <section className="screen">
      <header className="screen__head">
        <div>
          <h1>Recipes</h1>
          <p className="screen__sub">
            {allRecipes(data).length} in your library · {data.imported.length} imported
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

      {recipes.length === 0 ? (
        <EmptyState icon="🔍" title="No matches" body="Try a different search or clear the filter." />
      ) : (
        <ul className="rlist">
          {recipes.map((recipe) => {
            const serving = planServings(recipe, size, data.settings.leftovers);
            const excluded = exclusionFor(recipe, data);
            const rating = data.ratings[recipe.id];
            return (
              <li key={recipe.id}>
                <button type="button" className="ritem" onClick={() => setOpen(recipe)}>
                  <span className="ritem__emoji" aria-hidden="true">
                    {recipe.emoji}
                  </span>
                  <span className="ritem__text">
                    <strong>
                      {recipe.name} {rating ? RATING_EMOJI[rating] : ''}
                    </strong>
                    <span className="ritem__meta">
                      {recipe.cuisine} · {formatMinutes(scaledTime(recipe, serving.servings))} ·{' '}
                      {formatMoney(estimateMealCost(recipe, serving.servings, getStore(data.settings.storeId).factor))}
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

      {open && <RecipeSheet data={data} recipe={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function RecipeSheet({ data, recipe, onClose }: { data: HomeCookData; recipe: Recipe; onClose: () => void }) {
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
            <span aria-hidden="true">{RATING_EMOJI[value]}</span>
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
