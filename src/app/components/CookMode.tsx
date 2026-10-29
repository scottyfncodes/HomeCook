import { useEffect, useState } from 'react';
import type { Rating, Recipe } from '@homecook/core/types';
import { RATINGS, RATING_LABEL } from '@homecook/core/types';
import { getIngredient } from '@homecook/data/ingredients';
import { scaleIngredients } from '@homecook/engine/scale';
import { formatAmount } from '@homecook/engine/units';
import { Btn } from '@homecook/app/components/ui';
import { DishArt } from '@homecook/app/components/DishArt';

/**
 * The recipe, one step at a time, readable from across the kitchen.
 *
 * Page 0 is getting everything out, scaled to the servings being cooked; then
 * each step; then a rating, which is what teaches the planner. The screen is
 * kept awake where the browser allows it, because a phone that locks itself
 * mid-recipe gets unlocked with oily fingers.
 */
export function CookMode({
  recipe,
  servings,
  context,
  onClose,
  onFinish,
}: {
  recipe: Recipe;
  servings: number;
  /** A line above the title, such as "Thursday dinner". */
  context?: string;
  onClose: () => void;
  /** Called from the last page; `undefined` means finished without rating. */
  onFinish: (rating: Rating | undefined) => void;
}) {
  const steps = recipe.steps;
  const last = steps.length + 1;
  const [page, setPage] = useState(0);
  const [gathered, setGathered] = useState<Set<string>>(() => new Set());
  const [peek, setPeek] = useState(false);
  const ingredients = scaleIngredients(recipe, servings);

  useWakeLock();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') setPage((p) => Math.min(last, p + 1));
      if (event.key === 'ArrowLeft') setPage((p) => Math.max(0, p - 1));
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [last, onClose]);

  const toggle = (id: string) =>
    setGathered((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const list = (
    <ul className="cook__ingredients">
      {ingredients.map((item) => {
        const name = getIngredient(item.ingredientId)?.name ?? item.ingredientId;
        const on = gathered.has(item.ingredientId);
        return (
          <li key={item.ingredientId}>
            <button
              type="button"
              className={on ? 'cook__ing cook__ing--on' : 'cook__ing'}
              aria-pressed={on}
              onClick={() => toggle(item.ingredientId)}
            >
              <span className="cook__tick" aria-hidden="true">
                {on ? '✓' : ''}
              </span>
              <span className="cook__ing-name">
                {name}
                {item.optional ? <em> (optional)</em> : null}
              </span>
              <strong>{formatAmount(item.qty, item.unit)}</strong>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="cook" role="dialog" aria-modal="true" aria-label={`Cooking ${recipe.name}`}>
      <header className="cook__head">
        <button type="button" className="cook__close" onClick={onClose}>
          Close
        </button>
        <div className="cook__title">
          {context && <span className="cook__context">{context}</span>}
          <strong>{recipe.name}</strong>
          <span className="cook__context">{servings} servings</span>
        </div>
        {page > 0 && page < last ? (
          <button
            type="button"
            className={peek ? 'cook__peek cook__peek--on' : 'cook__peek'}
            aria-expanded={peek}
            onClick={() => setPeek((v) => !v)}
          >
            Amounts
          </button>
        ) : (
          <span className="cook__peek cook__peek--blank" aria-hidden="true" />
        )}
      </header>

      <ol className="cook__progress" aria-hidden="true">
        {Array.from({ length: last + 1 }, (_, index) => (
          <li key={index} className={index <= page ? 'cook__seg cook__seg--on' : 'cook__seg'} />
        ))}
      </ol>

      <div className="cook__body">
        {page === 0 && (
          <>
            <div className="cook__intro">
              <DishArt format={recipe.format} size={64} />
              <div>
                <h2 className="cook__h">Get it all out first</h2>
                <p className="cook__sub">Tap each one as it lands on the counter.</p>
              </div>
            </div>
            {list}
          </>
        )}

        {page > 0 && page < last && (
          <>
            {peek && <div className="cook__peekbox">{list}</div>}
            <p className="cook__count">
              Step {page} of {steps.length}
            </p>
            <p className="cook__step">{steps[page - 1]}</p>
          </>
        )}

        {page === last && (
          <div className="cook__done">
            <DishArt format={recipe.format} size={80} />
            <h2 className="cook__h">How was it?</h2>
            <p className="cook__sub">Your answer steers what HomeCook plans next.</p>
            <div className="cook__ratings">
              {RATINGS.map((rating) => (
                <button key={rating} type="button" className="rating" onClick={() => onFinish(rating)}>
                  {RATING_LABEL[rating]}
                </button>
              ))}
            </div>
            <Btn variant="ghost" wide onClick={() => onFinish(undefined)}>
              Skip rating
            </Btn>
          </div>
        )}
      </div>

      {page < last && (
        <footer className="cook__foot">
          <Btn wide onClick={() => setPage(page - 1)} disabled={page === 0}>
            Back
          </Btn>
          <Btn variant="primary" wide onClick={() => setPage(page + 1)}>
            {page === 0 ? 'Start cooking' : page === steps.length ? 'Finished' : 'Next step'}
          </Btn>
        </footer>
      )}
    </div>
  );
}

/** Ask the browser to keep the screen on while cooking; harmless where unsupported. */
function useWakeLock() {
  useEffect(() => {
    type Sentinel = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } };
    if (!nav.wakeLock) return;
    let sentinel: Sentinel | null = null;
    let cancelled = false;
    const request = () => {
      nav.wakeLock
        ?.request('screen')
        .then((lock) => {
          if (cancelled) void lock.release().catch(() => {});
          else sentinel = lock;
        })
        .catch(() => {});
    };
    request();
    // The lock drops whenever the tab is hidden; take it back on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, []);
}
