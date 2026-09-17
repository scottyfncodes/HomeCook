import { useMemo, useState } from 'react';
import type { HomeCookData, Ingredient } from '@homecook/core/types';
import { CATEGORY_LABEL, CATEGORY_ORDER } from '@homecook/core/types';
import { addPantryItem, removePantryItem, stockStaples, togglePantryItem } from '@homecook/core/actions';
import { apply } from '@homecook/app/useHomeCook';
import { INGREDIENTS, STAPLE_IDS, getIngredient } from '@homecook/data/ingredients';
import { buildGroceryList } from '@homecook/engine/grocery';
import { formatAmount } from '@homecook/engine/units';
import { Btn, Chip, EmptyState, Sheet } from '@homecook/app/components/ui';

export function PantryScreen({ data }: { data: HomeCookData }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Ingredient | null>(null);

  const stocked = useMemo(
    () =>
      data.pantry
        .map((item) => ({ item, ingredient: getIngredient(item.ingredientId) }))
        .filter((entry): entry is { item: (typeof data.pantry)[number]; ingredient: Ingredient } =>
          Boolean(entry.ingredient),
        ),
    [data.pantry],
  );

  const savings = useMemo(() => buildGroceryList(data).covered.filter((l) => l.coveredBy === 'pantry'), [data]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return INGREDIENTS.filter(
      (ingredient) =>
        ingredient.name.toLowerCase().includes(q) &&
        !data.pantry.some((p) => p.ingredientId === ingredient.id),
    ).slice(0, 8);
  }, [data.pantry, query]);

  const missingStaples = STAPLE_IDS.filter((id) => !data.pantry.some((p) => p.ingredientId === id));

  return (
    <section className="screen">
      <header className="screen__head">
        <div>
          <h1>Pantry</h1>
          <p className="screen__sub">
            {stocked.length} {stocked.length === 1 ? 'item' : 'items'} · {savings.length} kept off this
            week's list
          </p>
        </div>
      </header>

      <input
        className="input"
        placeholder="Add something you have…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {matches.length > 0 && (
        <ul className="suggest">
          {matches.map((ingredient) => (
            <li key={ingredient.id}>
              <button
                type="button"
                onClick={() => {
                  apply((current) => addPantryItem(current, ingredient.id));
                  setQuery('');
                }}
              >
                + {ingredient.name}
                <small>{CATEGORY_LABEL[ingredient.category]}</small>
              </button>
            </li>
          ))}
        </ul>
      )}

      {missingStaples.length > 0 && (
        <div className="card card--inset">
          <p>
            <strong>Stock the usual staples?</strong> Salt, pepper, oil, spices, rice, flour — the
            things most kitchens always have.
          </p>
          <Btn wide onClick={() => apply(stockStaples)}>
            Add {missingStaples.length} staples
          </Btn>
        </div>
      )}

      {stocked.length === 0 ? (
        <EmptyState
          icon="🧂"
          title="Your pantry is empty"
          body="Anything listed here is subtracted from the grocery list before HomeCook prices the week."
        />
      ) : (
        CATEGORY_ORDER.map((category) => {
          const rows = stocked.filter((entry) => entry.ingredient.category === category);
          if (!rows.length) return null;
          return (
            <div key={category} className="glist">
              <h2 className="glist__title">{CATEGORY_LABEL[category]}</h2>
              <ul>
                {rows.map(({ item, ingredient }) => (
                  <li key={ingredient.id} className="gitem">
                    <button type="button" className="gitem__body" onClick={() => setEditing(ingredient)}>
                      <span className="gitem__name">{ingredient.name}</span>
                      <span className="gitem__meta">
                        {item.qty !== undefined && item.unit
                          ? `${formatAmount(item.qty, item.unit)} on hand`
                          : 'always on hand'}
                      </span>
                    </button>
                    <Btn small variant="ghost" onClick={() => apply((c) => removePantryItem(c, ingredient.id))}>
                      Remove
                    </Btn>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}

      <p className="fineprint">
        "Always on hand" covers any amount a recipe asks for. Give an item a quantity and HomeCook
        subtracts what the week uses instead.
      </p>

      {editing && <QuantitySheet data={data} ingredient={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function QuantitySheet({
  data,
  ingredient,
  onClose,
}: {
  data: HomeCookData;
  ingredient: Ingredient;
  onClose: () => void;
}) {
  const existing = data.pantry.find((p) => p.ingredientId === ingredient.id);
  const [qty, setQty] = useState(existing?.qty !== undefined ? String(existing.qty) : '');

  return (
    <Sheet open title={ingredient.name} onClose={onClose}>
      <p className="sheet__lede">
        How much do you have? Leave it blank for things you never run out of.
      </p>
      <div className="qtyrow">
        <input
          className="input"
          inputMode="decimal"
          placeholder="Quantity"
          value={qty}
          onChange={(event) => setQty(event.target.value)}
        />
        <span className="qtyrow__unit">{ingredient.unit}</span>
      </div>
      <div className="chiprow">
        <Chip active={!qty} onClick={() => setQty('')}>
          Always on hand
        </Chip>
      </div>
      <Btn
        variant="primary"
        wide
        onClick={() => {
          const value = Number(qty);
          apply((current) =>
            qty.trim() && Number.isFinite(value) && value > 0
              ? addPantryItem(current, ingredient.id, value, ingredient.unit)
              : addPantryItem(current, ingredient.id),
          );
          onClose();
        }}
      >
        Save
      </Btn>
      <Btn
        variant="ghost"
        wide
        onClick={() => {
          apply((current) => togglePantryItem(current, ingredient.id));
          onClose();
        }}
      >
        Remove from pantry
      </Btn>
    </Sheet>
  );
}
