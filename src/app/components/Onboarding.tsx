import { useMemo, useState } from 'react';
import type { Protein } from '@homecook/core/types';
import { completeOnboarding } from '@homecook/core/actions';
import { freshData } from '@homecook/core/persist';
import { apply } from '@homecook/app/useHomeCook';
import { DEFAULT_STORE_ID, getStore, STORES } from '@homecook/data/stores';
import { budgetStatus, buildGroceryList } from '@homecook/engine/grocery';
import { resolveWeek, weekTotals } from '@homecook/engine/plan';
import { formatMinutes, formatMoney } from '@homecook/engine/units';
import { Btn, Chip, Meter, Stepper } from '@homecook/app/components/ui';

/**
 * The example week is planned with a fixed seed, and the first real week with
 * the same one, so the dinners on the opening screen are the dinners you get.
 */
export const PREVIEW_SEED = 5;

/** First run: the week you would get, then four questions, no typing. */
export function Onboarding() {
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [budget, setBudget] = useState(150);
  const [mealsPerWeek, setMeals] = useState(5);
  const [storeId, setStoreId] = useState(DEFAULT_STORE_ID);
  const [staples, setStaples] = useState(true);
  const [working, setWorking] = useState(false);

  const config = useMemo(
    () => ({ adults, children, budget, mealsPerWeek, storeId, stockStaples: staples, seed: PREVIEW_SEED }),
    [adults, children, budget, mealsPerWeek, storeId, staples],
  );

  // The planner runs in a few milliseconds, so the preview simply follows the
  // controls: change the budget or the headcount and the week re-plans.
  const preview = useMemo(() => {
    const data = completeOnboarding(freshData(), config);
    const resolved = resolveWeek(data);
    return {
      resolved,
      totals: weekTotals(resolved),
      budget: budgetStatus(data.settings.budget, buildGroceryList(data).total),
    };
  }, [config]);

  const people = adults + children;
  const store = getStore(storeId);

  return (
    <div className="onboard">
      <div className="onboard__inner">
        <header className="onboard__brand">
          <PotMark />
          <div>
            <h1 className="onboard__title">HomeCook</h1>
            <p className="onboard__tag">Plans your dinners, prices the shopping, keeps it under budget.</p>
          </div>
        </header>

        <section className="preview card" aria-labelledby="preview-title">
          <div className="preview__head">
            <span className="preview__kicker">Example week</span>
            <h2 id="preview-title" className="preview__title">
              {people} {people === 1 ? 'person' : 'people'} · {mealsPerWeek}{' '}
              {mealsPerWeek === 1 ? 'dinner' : 'dinners'} · {store.name}
            </h2>
          </div>

          <ol className="preview__list">
            {preview.resolved.map((item) => (
              <li key={item.meal.id} className="preview__meal">
                <span className="preview__day">{item.meal.day.slice(0, 3)}</span>
                <span
                  className={`preview__plate preview__plate--${plateTone(item.recipe?.protein)}`}
                  aria-hidden="true"
                >
                  {item.recipe?.emoji ?? '·'}
                </span>
                <span className="preview__text">
                  <span className="preview__name">{item.recipe?.name ?? 'Open night'}</span>
                  {item.recipe ? (
                    <span className="preview__meta">
                      {formatMinutes(item.time)} · {item.servings} servings
                    </span>
                  ) : null}
                </span>
                {item.recipe ? <span className="preview__cost">~{formatMoney(item.cost)}</span> : null}
              </li>
            ))}
          </ol>

          <div className="budget__top preview__total">
            <div>
              <span className="budget__label">Estimated basket</span>
              <strong className={preview.budget.over ? 'budget__spent budget__spent--over' : 'budget__spent'}>
                {formatMoney(preview.budget.spent)}
              </strong>
            </div>
            <div className="budget__right">
              <span className="budget__label">Budget {formatMoney(preview.budget.budget)}</span>
              <strong className={preview.budget.over ? 'budget__rem budget__rem--over' : 'budget__rem'}>
                {preview.budget.over
                  ? `${formatMoney(Math.abs(preview.budget.remaining))} over`
                  : `${formatMoney(preview.budget.remaining)} left`}
              </strong>
            </div>
          </div>
          <Meter fraction={preview.budget.fraction} over={preview.budget.over} />
          <p className="fineprint preview__note">
            {preview.totals.servings} servings, priced in whole packages — an estimate, not a checkout total.
            This becomes your week; swap or lock any night after.
          </p>
        </section>

        <details className="onboard__setup card">
          <summary className="onboard__summary">
            <span className="onboard__summary-text">
              <span className="onboard__summary-title">Adjust for your household</span>
              <span className="onboard__summary-meta">
                {adults} {adults === 1 ? 'adult' : 'adults'}
                {children > 0 ? `, ${children} ${children === 1 ? 'child' : 'children'}` : ''} · {mealsPerWeek}{' '}
                dinners · ${budget} · {staples ? 'staples stocked' : 'empty pantry'}
              </span>
            </span>
            <span className="onboard__summary-chevron" aria-hidden="true" />
          </summary>

          <div className="onboard__fields">
            <Stepper label="Adults" value={adults} min={0} max={20} onChange={setAdults} />
            <Stepper label="Children" value={children} min={0} max={20} onChange={setChildren} />
            <Stepper label="Dinners this week" value={mealsPerWeek} min={1} max={7} onChange={setMeals} />
            <Stepper
              label="Weekly budget"
              value={budget}
              min={20}
              max={1000}
              step={10}
              suffix=" $"
              onChange={setBudget}
            />

            <span className="field__label">Where do you shop?</span>
            <div className="chiprow">
              {STORES.map((item) => (
                <Chip key={item.id} active={storeId === item.id} onClick={() => setStoreId(item.id)}>
                  {item.name}
                </Chip>
              ))}
            </div>
            <p className="fineprint">Only used to estimate prices. Change it any time.</p>

            <span className="field__label">Kitchen staples</span>
            <div className="chiprow">
              <Chip active={staples} onClick={() => setStaples(true)}>
                We have the usual
              </Chip>
              <Chip active={!staples} onClick={() => setStaples(false)}>
                Start empty
              </Chip>
            </div>
            <p className="fineprint">
              Salt, oil, spices, rice and so on — anything in the pantry is left off the grocery list.
            </p>
          </div>
        </details>

        <div className="onboard__cta">
          <Btn
            variant="primary"
            wide
            disabled={working || people === 0}
            onClick={() => {
              setWorking(true);
              setTimeout(() => {
                apply((current) => completeOnboarding(current, config));
              }, 30);
            }}
          >
            {working ? 'Planning your week…' : 'Plan my first week'}
          </Btn>
          <p className="fineprint onboard__privacy">Nothing leaves this device. No account, no sign-in, no tracking.</p>
        </div>
      </div>
    </div>
  );
}

/** Which tint sits behind a recipe's emoji on the example week. */
function plateTone(protein: Protein | undefined): string {
  switch (protein) {
    case 'beef':
    case 'sausage':
      return 'red';
    case 'pork':
    case 'turkey':
    case 'chicken':
      return 'gold';
    case 'seafood':
      return 'blue';
    case 'vegetarian':
      return 'green';
    default:
      return 'neutral';
  }
}

/** A pot on the hob, steam rising: the one piece of art on the first screen. */
function PotMark() {
  return (
    <svg className="potmark" viewBox="0 0 64 64" width="56" height="56" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
        <path className="potmark__wisp" d="M22 24c-3-4 3-7 0-11" />
        <path className="potmark__wisp potmark__wisp--mid" d="M32 22c-3-4 3-8 0-12" />
        <path className="potmark__wisp potmark__wisp--late" d="M42 24c-3-4 3-7 0-11" />
      </g>
      <path d="M14 32h36" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M29 28h6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M17 36h30v9a11 11 0 0 1-11 11H28a11 11 0 0 1-11-11z" fill="currentColor" />
      <path d="M11 39h6M47 39h6" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}
