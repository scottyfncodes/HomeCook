import type { ResolvedMeal } from '@homecook/engine/plan';
import { RATING_EMOJI } from '@homecook/core/types';
import type { Rating } from '@homecook/core/types';
import { formatMinutes, formatMoney } from '@homecook/engine/units';
import { Btn } from '@homecook/app/components/ui';

export function MealCard({
  resolved,
  householdSize,
  rating,
  onPick,
  onSwap,
  onWhy,
  onOptions,
  onToggleLock,
}: {
  resolved: ResolvedMeal;
  householdSize: number;
  rating?: Rating;
  onPick: () => void;
  onSwap: () => void;
  onWhy: () => void;
  onOptions: () => void;
  onToggleLock: () => void;
}) {
  const { meal, recipe } = resolved;

  if (!recipe) {
    return (
      <article className="meal meal--empty">
        <header className="meal__day">{meal.day}</header>
        <button type="button" className="meal__pick" onClick={onPick}>
          <span className="meal__pick-plus" aria-hidden="true">
            +
          </span>
          Choose a meal
        </button>
      </article>
    );
  }

  const guests = meal.dinersOverride !== null && meal.dinersOverride !== householdSize;

  return (
    <article className={`meal ${meal.locked ? 'meal--locked' : ''}`}>
      <header className="meal__day">
        {meal.day}
        <button
          type="button"
          className={`meal__lock ${meal.locked ? 'meal__lock--on' : ''}`}
          onClick={onToggleLock}
          aria-pressed={meal.locked}
          aria-label={meal.locked ? `Unlock ${recipe.name}` : `Lock ${recipe.name}`}
        >
          {meal.locked ? '🔒 Locked' : '🔓 Lock'}
        </button>
      </header>

      <button type="button" className="meal__main" onClick={onWhy}>
        <span className="meal__emoji" aria-hidden="true">
          {recipe.emoji}
        </span>
        <span className="meal__text">
          <span className="meal__name">
            {recipe.name}
            {rating ? <span className="meal__rating">{RATING_EMOJI[rating]}</span> : null}
          </span>
          <span className="meal__desc">{recipe.description}</span>
        </span>
      </button>

      <div className="meal__chips">
        <span className={`tag ${guests ? 'tag--alert' : ''}`}>
          {resolved.diners} {resolved.diners === 1 ? 'diner' : 'diners'}
          {guests ? ' (guests)' : ''}
        </span>
        <span className="tag">{resolved.servings} servings</span>
        <span className="tag">{formatMinutes(resolved.time)}</span>
        <span className="tag tag--money">~{formatMoney(resolved.cost)}</span>
        <span className="tag tag--quiet">{recipe.protein}</span>
        {resolved.leftovers > 0 ? (
          <span className="tag tag--good">
            {resolved.leftovers} serving{resolved.leftovers === 1 ? '' : 's'} left over
          </span>
        ) : null}
        {meal.cooked ? <span className="tag tag--good">cooked</span> : null}
      </div>

      <div className="meal__actions">
        <Btn small variant="ghost" onClick={onSwap}>
          Swap
        </Btn>
        <Btn small variant="ghost" onClick={onOptions}>
          Diners & more
        </Btn>
        <Btn small variant="ghost" onClick={onWhy}>
          Why this?
        </Btn>
      </div>
    </article>
  );
}
