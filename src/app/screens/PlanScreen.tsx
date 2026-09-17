import { useMemo, useState } from 'react';
import type { HomeCookData, Rating } from '@homecook/core/types';
import { RATINGS, RATING_EMOJI, RATING_LABEL } from '@homecook/core/types';
import {
  markCooked,
  regenerateWeek,
  setExtraServings,
  setMealDiners,
  setMealRecipe,
  toggleLock,
} from '@homecook/core/actions';
import { apply } from '@homecook/app/useHomeCook';
import { budgetStatus, buildGroceryList } from '@homecook/engine/grocery';
import { householdSize, resolveWeek, weekTotals } from '@homecook/engine/plan';
import { explainMeal, swapOptions } from '@homecook/engine/planner';
import { plannableRecipes } from '@homecook/engine/library';
import { formatMinutes, formatMoney } from '@homecook/engine/units';
import { estimateMealCost } from '@homecook/engine/pricing';
import { getStore } from '@homecook/data/stores';
import { planServings } from '@homecook/engine/scale';
import { IngredientList } from '@homecook/app/components/IngredientList';
import { MealCard } from '@homecook/app/components/MealCard';
import { Btn, Meter, Row, Sheet, Stepper } from '@homecook/app/components/ui';

type SheetState =
  | { kind: 'swap'; mealId: string }
  | { kind: 'why'; mealId: string }
  | { kind: 'options'; mealId: string }
  | { kind: 'pick'; mealId: string }
  | null;

export function PlanScreen({ data }: { data: HomeCookData }) {
  const [sheet, setSheet] = useState<SheetState>(null);
  const [regenerating, setRegenerating] = useState(false);

  const resolved = useMemo(() => resolveWeek(data), [data]);
  const totals = useMemo(() => weekTotals(resolved), [resolved]);
  const grocery = useMemo(() => buildGroceryList(data), [data]);
  const budget = budgetStatus(data.settings.budget, grocery.total);
  const size = householdSize(data.household);
  const lockedCount = data.plan.meals.filter((m) => m.locked).length;

  const regenerate = () => {
    setRegenerating(true);
    // Let the button paint its pressed state before the planner runs.
    setTimeout(() => {
      apply((current) => regenerateWeek(current));
      setRegenerating(false);
    }, 30);
  };

  const active = sheet ? data.plan.meals.find((m) => m.id === sheet.mealId) ?? null : null;

  return (
    <section className="screen">
      <header className="screen__head">
        <div>
          <h1>This week</h1>
          <p className="screen__sub">
            {totals.plannedMeals} of {data.plan.meals.length} dinners · {size}{' '}
            {size === 1 ? 'person' : 'people'} at home
          </p>
        </div>
      </header>

      <div className="budget card">
        <div className="budget__top">
          <div>
            <span className="budget__label">Estimated basket</span>
            <strong className={budget.over ? 'budget__spent budget__spent--over' : 'budget__spent'}>
              {formatMoney(budget.spent)}
            </strong>
          </div>
          <div className="budget__right">
            <span className="budget__label">Budget {formatMoney(budget.budget)}</span>
            <strong className={budget.over ? 'budget__rem budget__rem--over' : 'budget__rem'}>
              {budget.over
                ? `${formatMoney(Math.abs(budget.remaining))} over`
                : `${formatMoney(budget.remaining)} left`}
            </strong>
          </div>
        </div>
        <Meter fraction={budget.fraction} over={budget.over} />
        <div className="budget__facts">
          <span>{grocery.itemCount} items to buy</span>
          <span>{totals.servings} servings</span>
          {totals.leftovers > 0 && <span>{totals.leftovers} leftover</span>}
          <span>{getStore(data.settings.storeId).name}</span>
        </div>
      </div>

      <div className="plan__actions">
        <Btn variant="primary" wide onClick={regenerate} disabled={regenerating}>
          {regenerating ? 'Planning…' : 'Regenerate week'}
        </Btn>
        {lockedCount > 0 && (
          <p className="plan__note">
            {lockedCount} locked {lockedCount === 1 ? 'meal stays' : 'meals stay'} put.
          </p>
        )}
      </div>

      <div className="meals">
        {resolved.map((item) => (
          <MealCard
            key={item.meal.id}
            resolved={item}
            householdSize={size}
            rating={item.recipe ? data.ratings[item.recipe.id] : undefined}
            onPick={() => setSheet({ kind: 'pick', mealId: item.meal.id })}
            onSwap={() => setSheet({ kind: 'swap', mealId: item.meal.id })}
            onWhy={() => setSheet({ kind: 'why', mealId: item.meal.id })}
            onOptions={() => setSheet({ kind: 'options', mealId: item.meal.id })}
            onToggleLock={() => apply((current) => toggleLock(current, item.meal.id))}
          />
        ))}
      </div>

      <p className="fineprint">
        Prices are estimates from HomeCook's own price table at {getStore(data.settings.storeId).name} —
        not a checkout total.
      </p>

      {sheet?.kind === 'swap' && active && (
        <SwapSheet data={data} mealId={sheet.mealId} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'why' && active && (
        <WhySheet data={data} mealId={sheet.mealId} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'options' && active && (
        <OptionsSheet data={data} mealId={sheet.mealId} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'pick' && active && (
        <PickSheet data={data} mealId={sheet.mealId} onClose={() => setSheet(null)} />
      )}
    </section>
  );
}

function SwapSheet({ data, mealId, onClose }: { data: HomeCookData; mealId: string; onClose: () => void }) {
  const options = useMemo(() => swapOptions(data, mealId, 8), [data, mealId]);
  const meal = data.plan.meals.find((m) => m.id === mealId)!;

  return (
    <Sheet open title={`Swap ${meal.day}`} onClose={onClose}>
      {options.length === 0 ? (
        <p className="sheet__empty">
          Nothing else fits your exclusions and this week's meals. Loosen a preference on the Profile
          tab, or import more recipes.
        </p>
      ) : (
        <ul className="swap">
          {options.map((option) => (
            <li key={option.recipe.id}>
              <button
                type="button"
                className="swap__item"
                onClick={() => {
                  apply((current) => setMealRecipe(current, mealId, option.recipe.id));
                  onClose();
                }}
              >
                <span className="swap__emoji" aria-hidden="true">
                  {option.recipe.emoji}
                </span>
                <span className="swap__text">
                  <strong>{option.recipe.name}</strong>
                  <span className="swap__meta">
                    {option.servings} servings · {formatMinutes(option.time)} ·{' '}
                    {option.recipe.cuisine}
                  </span>
                  {option.reasons[0] && <span className="swap__reason">• {option.reasons[0]}</span>}
                  {option.cautions[0] && <span className="swap__caution">• {option.cautions[0]}</span>}
                </span>
                <span
                  className={`swap__delta ${option.costDelta > 0 ? 'swap__delta--up' : 'swap__delta--down'}`}
                >
                  {option.costDelta >= 0 ? '+' : '−'}
                  {formatMoney(Math.abs(option.costDelta))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="fineprint">Amounts show the change to the whole week's basket, not the meal alone.</p>
    </Sheet>
  );
}

function WhySheet({ data, mealId, onClose }: { data: HomeCookData; mealId: string; onClose: () => void }) {
  const candidate = useMemo(() => explainMeal(data, mealId), [data, mealId]);
  const meal = data.plan.meals.find((m) => m.id === mealId)!;

  if (!candidate) {
    return (
      <Sheet open title={meal.day} onClose={onClose}>
        <p className="sheet__empty">Nothing planned for this day yet.</p>
      </Sheet>
    );
  }

  const recipe = candidate.recipe;
  return (
    <Sheet open title={recipe.name} onClose={onClose}>
      <p className="sheet__lede">{recipe.description}</p>

      <h3 className="sheet__h3">Why HomeCook picked this</h3>
      {candidate.reasons.length ? (
        <ul className="reasons">
          {candidate.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : (
        <p className="sheet__empty">
          Nothing strong either way — it simply scored highest for this slot.
        </p>
      )}

      {candidate.cautions.length > 0 && (
        <>
          <h3 className="sheet__h3">Counting against it</h3>
          <ul className="reasons reasons--bad">
            {candidate.cautions.map((caution) => (
              <li key={caution}>{caution}</li>
            ))}
          </ul>
        </>
      )}

      <h3 className="sheet__h3">The maths</h3>
      <ul className="score">
        {candidate.components.map((component) => (
          <li key={component.label}>
            <span>{component.label}</span>
            <strong className={component.points < 0 ? 'score--bad' : 'score--good'}>
              {component.points > 0 ? '+' : ''}
              {component.points}
            </strong>
          </li>
        ))}
        <li className="score__total">
          <span>Total</span>
          <strong>{candidate.score}</strong>
        </li>
      </ul>

      <h3 className="sheet__h3">Ingredients for {candidate.servings} servings</h3>
      <IngredientList recipe={recipe} servings={candidate.servings} />

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
    </Sheet>
  );
}

function OptionsSheet({ data, mealId, onClose }: { data: HomeCookData; mealId: string; onClose: () => void }) {
  const meal = data.plan.meals.find((m) => m.id === mealId)!;
  const size = householdSize(data.household);
  const diners = meal.dinersOverride ?? size;
  const recipe = plannableRecipes(data).find((r) => r.id === meal.recipeId);
  const serving = recipe ? planServings(recipe, diners, data.settings.leftovers, meal.extraServings) : null;
  const cost =
    recipe && serving
      ? estimateMealCost(recipe, serving.servings, getStore(data.settings.storeId).factor)
      : 0;

  return (
    <Sheet open title={`${meal.day} · ${recipe?.name ?? 'Empty'}`} onClose={onClose}>
      <h3 className="sheet__h3">Who's eating</h3>
      <Stepper
        label="Diners"
        value={diners}
        min={1}
        max={30}
        onChange={(next) => apply((current) => setMealDiners(current, mealId, next))}
      />
      {meal.dinersOverride !== null && (
        <Btn small variant="ghost" onClick={() => apply((current) => setMealDiners(current, mealId, null))}>
          Back to household ({size})
        </Btn>
      )}
      <p className="fineprint">
        Changing this only affects {meal.day}. Your household stays {size}.
      </p>

      <h3 className="sheet__h3">Cook extra</h3>
      <Stepper
        label="Extra servings"
        value={meal.extraServings}
        min={0}
        max={20}
        onChange={(next) => apply((current) => setExtraServings(current, mealId, next))}
      />
      <p className="fineprint">Servings cooked on purpose for lunches or another night.</p>

      {serving && (
        <div className="card card--inset">
          <Row label="Servings cooked" value={serving.servings} />
          <Row label="Leftovers" value={serving.leftovers} />
          <Row label="Estimated ingredients" value={formatMoney(cost)} />
        </div>
      )}

      <h3 className="sheet__h3">After you cook it</h3>
      <div className="ratings">
        {RATINGS.map((rating: Rating) => (
          <button
            key={rating}
            type="button"
            className={`rating ${data.ratings[meal.recipeId ?? ''] === rating ? 'rating--on' : ''}`}
            disabled={!meal.recipeId}
            onClick={() => {
              apply((current) => markCooked(current, mealId, rating));
              onClose();
            }}
          >
            <span aria-hidden="true">{RATING_EMOJI[rating]}</span>
            {RATING_LABEL[rating]}
          </button>
        ))}
      </div>
      <p className="fineprint">
        Rating a meal marks it cooked, remembers the date, and feeds your taste profile.
      </p>

      {meal.recipeId && (
        <Btn
          variant="danger"
          wide
          onClick={() => {
            apply((current) => setMealRecipe(current, mealId, null));
            onClose();
          }}
        >
          Clear this day
        </Btn>
      )}
    </Sheet>
  );
}

function PickSheet({ data, mealId, onClose }: { data: HomeCookData; mealId: string; onClose: () => void }) {
  const options = useMemo(() => swapOptions(data, mealId, 12), [data, mealId]);
  const meal = data.plan.meals.find((m) => m.id === mealId)!;

  return (
    <Sheet open title={`Choose ${meal.day}`} onClose={onClose}>
      <ul className="swap">
        {options.map((option) => (
          <li key={option.recipe.id}>
            <button
              type="button"
              className="swap__item"
              onClick={() => {
                apply((current) => setMealRecipe(current, mealId, option.recipe.id));
                onClose();
              }}
            >
              <span className="swap__emoji" aria-hidden="true">
                {option.recipe.emoji}
              </span>
              <span className="swap__text">
                <strong>{option.recipe.name}</strong>
                <span className="swap__meta">
                  {option.servings} servings · {formatMinutes(option.time)}
                </span>
              </span>
              <span className="swap__delta swap__delta--up">+{formatMoney(Math.abs(option.costDelta))}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
