import { useState } from 'react';
import { completeOnboarding } from '@homecook/core/actions';
import { apply } from '@homecook/app/useHomeCook';
import { DEFAULT_STORE_ID, STORES } from '@homecook/data/stores';
import { Btn, Chip, Stepper } from '@homecook/app/components/ui';

/** First run: four questions, no typing, then a real week. */
export function Onboarding() {
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [budget, setBudget] = useState(150);
  const [mealsPerWeek, setMeals] = useState(5);
  const [storeId, setStoreId] = useState(DEFAULT_STORE_ID);
  const [staples, setStaples] = useState(true);
  const [working, setWorking] = useState(false);

  return (
    <div className="onboard">
      <div className="onboard__inner">
        <h1 className="onboard__title">HomeCook</h1>
        <p className="onboard__tag">Your meals. Your budget. Your kitchen.</p>

        <div className="card">
          <Stepper label="Adults" value={adults} min={0} max={20} onChange={setAdults} />
          <Stepper label="Children" value={children} min={0} max={20} onChange={setChildren} />
          <Stepper label="Dinners this week" value={mealsPerWeek} min={1} max={7} onChange={setMeals} />
          <Stepper
            label="Weekly budget"
            value={budget}
            min={20}
            max={1000}
            suffix=" $"
            onChange={(value) => setBudget(Math.round(value / 5) * 5)}
          />
        </div>

        <div className="card">
          <span className="field__label">Where do you shop?</span>
          <div className="chiprow">
            {STORES.map((store) => (
              <Chip key={store.id} active={storeId === store.id} onClick={() => setStoreId(store.id)}>
                {store.name}
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

        <Btn
          variant="primary"
          wide
          disabled={working || adults + children === 0}
          onClick={() => {
            setWorking(true);
            setTimeout(() => {
              apply((current) =>
                completeOnboarding(current, {
                  adults,
                  children,
                  budget,
                  mealsPerWeek,
                  storeId,
                  stockStaples: staples,
                }),
              );
            }, 30);
          }}
        >
          {working ? 'Planning your week…' : 'Plan my first week'}
        </Btn>
        <p className="fineprint">
          Nothing leaves this device. No account, no sign-in, no tracking.
        </p>
      </div>
    </div>
  );
}
