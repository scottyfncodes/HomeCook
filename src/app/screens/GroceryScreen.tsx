import { useMemo, useState } from 'react';
import type { Category, HomeCookData } from '@homecook/core/types';
import { CATEGORY_LABEL, CATEGORY_ORDER } from '@homecook/core/types';
import {
  addCustomGroceryItem,
  addPantryItem,
  clearCheckedItems,
  dismissGroceryItem,
  removeCustomGroceryItem,
  restoreGroceryItem,
  toggleChecked,
} from '@homecook/core/actions';
import { apply } from '@homecook/app/useHomeCook';
import { budgetStatus, buildGroceryList, type GroceryLine } from '@homecook/engine/grocery';
import { getStore } from '@homecook/data/stores';
import { formatAmount, formatMoney } from '@homecook/engine/units';
import { Btn, EmptyState, Meter, Row, Sheet } from '@homecook/app/components/ui';

export function GroceryScreen({ data }: { data: HomeCookData }) {
  const [detail, setDetail] = useState<GroceryLine | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftCategory, setDraftCategory] = useState<Category>('other');
  const [showCovered, setShowCovered] = useState(false);

  const list = useMemo(() => buildGroceryList(data), [data]);
  const budget = budgetStatus(data.settings.budget, list.total);
  const store = getStore(data.settings.storeId);

  if (list.itemCount === 0 && list.covered.length === 0) {
    return (
      <section className="screen">
        <header className="screen__head">
          <h1>Grocery</h1>
        </header>
        <EmptyState
          icon="🧺"
          title="Nothing to buy yet"
          body="Plan some dinners and the list builds itself from what those recipes need."
        />
      </section>
    );
  }

  return (
    <section className="screen">
      <header className="screen__head">
        <div>
          <h1>Grocery</h1>
          <p className="screen__sub">
            {list.checkedCount}/{list.itemCount} picked up · {store.name}
          </p>
        </div>
      </header>

      <div className="budget card">
        <div className="budget__top">
          <div>
            <span className="budget__label">Estimated basket</span>
            <strong className={budget.over ? 'budget__spent budget__spent--over' : 'budget__spent'}>
              {formatMoney(list.total)}
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
        <Meter fraction={list.itemCount ? list.checkedCount / list.itemCount : 0} />
        {list.unpricedItems > 0 && (
          <p className="fineprint">
            {list.unpricedItems} {list.unpricedItems === 1 ? 'item has' : 'items have'} no price
            estimate and {list.unpricedItems === 1 ? 'is' : 'are'} not in the total.
          </p>
        )}
      </div>

      {list.sections.map((section) => (
        <div key={section.category} className="glist">
          <h2 className="glist__title">{CATEGORY_LABEL[section.category]}</h2>
          <ul>
            {section.lines.map((line) => (
              <li key={line.key} className={line.checked ? 'gitem gitem--done' : 'gitem'}>
                <button
                  type="button"
                  className="gitem__check"
                  aria-pressed={line.checked}
                  aria-label={`${line.checked ? 'Uncheck' : 'Check off'} ${line.name}`}
                  onClick={() => apply((current) => toggleChecked(current, line.key))}
                >
                  {line.checked ? '✓' : ''}
                </button>
                <button type="button" className="gitem__body" onClick={() => setDetail(line)}>
                  <span className="gitem__name">{line.name}</span>
                  <span className="gitem__meta">
                    {line.kind === 'custom'
                      ? 'added by you'
                      : `${formatAmount(line.buyQty, line.unit)} needed${
                          line.packages > 0
                            ? ` · ${line.packages} × ${line.packageLabel}`
                            : ' · no price estimate'
                        }`}
                  </span>
                </button>
                <span className="gitem__price">{line.cost > 0 ? formatMoney(line.cost) : '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="glist__tools">
        {adding ? (
          <div className="addrow card">
            <input
              className="input"
              placeholder="Add an item…"
              value={draft}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && draft.trim()) {
                  apply((current) => addCustomGroceryItem(current, draft, draftCategory));
                  setDraft('');
                  setAdding(false);
                }
              }}
            />
            <select
              className="input input--select"
              value={draftCategory}
              onChange={(event) => setDraftCategory(event.target.value as Category)}
            >
              {CATEGORY_ORDER.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABEL[category]}
                </option>
              ))}
            </select>
            <div className="addrow__actions">
              <Btn small variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Btn>
              <Btn
                small
                variant="primary"
                disabled={!draft.trim()}
                onClick={() => {
                  apply((current) => addCustomGroceryItem(current, draft, draftCategory));
                  setDraft('');
                  setAdding(false);
                }}
              >
                Add
              </Btn>
            </div>
          </div>
        ) : (
          <Btn wide onClick={() => setAdding(true)}>
            + Add an item
          </Btn>
        )}

        {list.checkedCount > 0 && (
          <Btn variant="ghost" wide onClick={() => apply(clearCheckedItems)}>
            Clear {list.checkedCount} ticked
          </Btn>
        )}
      </div>

      {list.covered.length > 0 && (
        <div className="glist">
          <button type="button" className="glist__toggle" onClick={() => setShowCovered((v) => !v)}>
            {showCovered ? '▾' : '▸'} Not buying ({list.covered.length})
          </button>
          {showCovered && (
            <ul>
              {list.covered.map((line) => (
                <li key={line.key} className="gitem gitem--muted">
                  <span className="gitem__check gitem__check--flat" aria-hidden="true">
                    ·
                  </span>
                  <span className="gitem__body">
                    <span className="gitem__name">{line.name}</span>
                    <span className="gitem__meta">
                      {line.coveredBy === 'pantry'
                        ? `already in your pantry (${formatAmount(line.needQty, line.unit)} needed)`
                        : 'you said you have this'}
                    </span>
                  </span>
                  {line.coveredBy === 'dismissed' && (
                    <Btn small variant="ghost" onClick={() => apply((c) => restoreGroceryItem(c, line.key))}>
                      Undo
                    </Btn>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="fineprint">
        The list is rebuilt from the plan every time it changes — swap a meal or change a headcount and
        these quantities follow.
      </p>

      <Sheet open={detail !== null} title={detail?.name ?? ''} onClose={() => setDetail(null)}>
        {detail && (
          <>
            {detail.kind === 'ingredient' ? (
              <div className="card card--inset">
                <Row label="Needed this week" value={formatAmount(detail.needQty, detail.unit)} />
                {detail.fromPantry > 0 && (
                  <Row label="From your pantry" value={formatAmount(detail.fromPantry, detail.unit)} />
                )}
                <Row label="To buy" value={formatAmount(detail.buyQty, detail.unit)} />
                {detail.packages > 0 && (
                  <>
                    <Row label="Packages" value={`${detail.packages} × ${detail.packageLabel}`} />
                    <Row label="Estimated" value={formatMoney(detail.cost)} />
                    {detail.surplus > 0 && (
                      <Row label="Left over" value={formatAmount(detail.surplus, detail.unit)} />
                    )}
                  </>
                )}
                {!detail.priced && <p className="fineprint">HomeCook has no price for this one.</p>}
              </div>
            ) : (
              <p className="sheet__lede">You added this by hand.</p>
            )}

            {detail.meals.length > 0 && (
              <>
                <h3 className="sheet__h3">Used in</h3>
                <ul className="reasons">
                  {detail.meals.map((meal) => (
                    <li key={meal}>{meal}</li>
                  ))}
                </ul>
              </>
            )}

            {detail.kind === 'ingredient' ? (
              <>
                <Btn
                  wide
                  onClick={() => {
                    apply((current) => dismissGroceryItem(current, detail.key));
                    setDetail(null);
                  }}
                >
                  I already have this
                </Btn>
                <Btn
                  wide
                  variant="ghost"
                  onClick={() => {
                    apply((current) => addPantryItem(current, detail.key));
                    setDetail(null);
                  }}
                >
                  Keep it in my pantry from now on
                </Btn>
              </>
            ) : (
              <Btn
                wide
                variant="danger"
                onClick={() => {
                  apply((current) => removeCustomGroceryItem(current, detail.key));
                  setDetail(null);
                }}
              >
                Remove
              </Btn>
            )}
          </>
        )}
      </Sheet>
    </section>
  );
}
