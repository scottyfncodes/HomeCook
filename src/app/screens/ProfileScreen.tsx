import { useMemo, useRef, useState } from 'react';
import type { Cuisine, DietaryTag, HomeCookData, LeftoverPreference, Protein } from '@homecook/core/types';
import {
  applyImport,
  resetEverything,
  setHousehold,
  setSettings,
  toggleDietary,
  toggleDislikedCuisine,
  toggleDislikedProtein,
  toggleExcludedIngredient,
  toggleLikedCuisine,
  toggleLikedProtein,
} from '@homecook/core/actions';
import { apply, store } from '@homecook/app/useHomeCook';
import { exportData, exportFilename, importData } from '@homecook/core/persist';
import { INGREDIENTS, getIngredient } from '@homecook/data/ingredients';
import { STORES } from '@homecook/data/stores';
import { importRecipes } from '@homecook/engine/importer';
import { householdSize } from '@homecook/engine/plan';
import { buildTasteProfile, highlights } from '@homecook/engine/taste';
import { Btn, Chip, Row, SectionTitle, Stepper } from '@homecook/app/components/ui';

const PROTEINS: Protein[] = ['chicken', 'beef', 'pork', 'sausage', 'seafood', 'turkey', 'vegetarian'];
const CUISINES: Cuisine[] = [
  'american', 'italian', 'mexican', 'mediterranean', 'asian', 'korean', 'indian', 'thai', 'french',
];
const DIETARY: DietaryTag[] = ['vegetarian', 'pescatarian', 'gluten-free', 'dairy-free', 'pork-free', 'nut-free'];
const LEFTOVERS: LeftoverPreference[] = ['none', 'sometimes', 'frequently'];

export function ProfileScreen({ data }: { data: HomeCookData }) {
  const size = householdSize(data.household);
  const profile = useMemo(() => buildTasteProfile(data), [data]);
  const proteinTaste = highlights(profile, 'proteins');
  const cuisineTaste = highlights(profile, 'cuisines');
  const flavorTaste = highlights(profile, 'flavors');

  return (
    <section className="screen">
      <header className="screen__head">
        <div>
          <h1>Profile</h1>
          <p className="screen__sub">Everything here stays on this device.</p>
        </div>
      </header>

      <SectionTitle>Household</SectionTitle>
      <div className="card">
        <Stepper
          label="Adults"
          value={data.household.adults}
          min={0}
          max={20}
          onChange={(adults) => apply((current) => setHousehold(current, { adults }))}
        />
        <Stepper
          label="Children"
          value={data.household.children}
          min={0}
          max={20}
          onChange={(children) => apply((current) => setHousehold(current, { children }))}
        />
        <Stepper
          label="Regular guests"
          value={data.household.guests}
          min={0}
          max={20}
          onChange={(guests) => apply((current) => setHousehold(current, { guests }))}
        />
        <Row label="Everyone at the table" value={`${size} ${size === 1 ? 'person' : 'people'}`} />
        <p className="fineprint">
          One-off guests belong on the day itself — open a meal and change its headcount there.
        </p>
      </div>

      <SectionTitle>The week</SectionTitle>
      <div className="card">
        <div className="field">
          <label htmlFor="budget">Weekly grocery budget</label>
          <div className="qtyrow">
            <span className="qtyrow__unit">$</span>
            <input
              id="budget"
              className="input"
              inputMode="decimal"
              value={String(data.settings.budget)}
              onChange={(event) => {
                const value = Number(event.target.value.replace(/[^\d.]/g, ''));
                apply((current) => setSettings(current, { budget: Number.isFinite(value) ? value : 0 }));
              }}
            />
          </div>
        </div>
        <Stepper
          label="Dinners per week"
          value={data.settings.mealsPerWeek}
          min={1}
          max={7}
          onChange={(mealsPerWeek) => apply((current) => setSettings(current, { mealsPerWeek }))}
        />
        <Stepper
          label="Longest weeknight cook"
          value={data.settings.maxCookMinutes}
          min={15}
          max={180}
          suffix=" min"
          onChange={(maxCookMinutes) => apply((current) => setSettings(current, { maxCookMinutes }))}
        />

        <div className="field">
          <label htmlFor="store">Store for price estimates</label>
          <select
            id="store"
            className="input input--select"
            value={data.settings.storeId}
            onChange={(event) => apply((current) => setSettings(current, { storeId: event.target.value }))}
          >
            {STORES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — {item.note}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="field__label">Leftovers</span>
          <div className="chiprow">
            {LEFTOVERS.map((option) => (
              <Chip
                key={option}
                active={data.settings.leftovers === option}
                onClick={() => apply((current) => setSettings(current, { leftovers: option }))}
              >
                {option}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <SectionTitle>Taste</SectionTitle>
      <div className="card">
        <div className="field">
          <span className="field__label">Proteins we like</span>
          <div className="chiprow">
            {PROTEINS.map((protein) => (
              <Chip
                key={protein}
                tone="good"
                active={data.preferences.likedProteins.includes(protein)}
                onClick={() => apply((current) => toggleLikedProtein(current, protein))}
              >
                {protein}
              </Chip>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field__label">Never plan these</span>
          <div className="chiprow">
            {PROTEINS.map((protein) => (
              <Chip
                key={protein}
                tone="bad"
                active={data.preferences.dislikedProteins.includes(protein)}
                onClick={() => apply((current) => toggleDislikedProtein(current, protein))}
              >
                {protein}
              </Chip>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field__label">Cuisines we like</span>
          <div className="chiprow">
            {CUISINES.map((cuisine) => (
              <Chip
                key={cuisine}
                tone="good"
                active={data.preferences.likedCuisines.includes(cuisine)}
                onClick={() => apply((current) => toggleLikedCuisine(current, cuisine))}
              >
                {cuisine}
              </Chip>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field__label">Cuisines to go easy on</span>
          <div className="chiprow">
            {CUISINES.map((cuisine) => (
              <Chip
                key={cuisine}
                tone="bad"
                active={data.preferences.dislikedCuisines.includes(cuisine)}
                onClick={() => apply((current) => toggleDislikedCuisine(current, cuisine))}
              >
                {cuisine}
              </Chip>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field__label">Dietary rules</span>
          <div className="chiprow">
            {DIETARY.map((tag) => (
              <Chip
                key={tag}
                active={data.preferences.dietary.includes(tag)}
                onClick={() => apply((current) => toggleDietary(current, tag))}
              >
                {tag}
              </Chip>
            ))}
          </div>
          <p className="fineprint">A dietary rule is absolute: recipes that break it are never suggested.</p>
        </div>
      </div>

      <ExclusionEditor data={data} />

      <SectionTitle>What HomeCook has learned</SectionTitle>
      <div className="card">
        {profile.samples === 0 ? (
          <p>
            Nothing yet. Rate a few dinners, or import old recipes below, and this fills in from real
            signals rather than guesses.
          </p>
        ) : (
          <>
            <Row label="Signals so far" value={profile.samples} />
            <TasteRow label="Proteins" data={proteinTaste} />
            <TasteRow label="Cuisines" data={cuisineTaste} />
            <TasteRow label="Flavours" data={flavorTaste} />
          </>
        )}
      </div>

      <ImportPanel />

      <SectionTitle>Your data</SectionTitle>
      <DataPanel data={data} />

      <p className="fineprint">
        HomeCook — your meals, your budget, your kitchen. No account, no server, no analytics. All of
        it lives in this browser until you export it.
      </p>
    </section>
  );
}

function TasteRow({ label, data }: { label: string; data: { likes: { label: string }[]; dislikes: { label: string }[] } }) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="chiprow">
        {data.likes.map((item) => (
          <Chip key={item.label} tone="good">
            👍 {item.label}
          </Chip>
        ))}
        {data.dislikes.map((item) => (
          <Chip key={item.label} tone="bad">
            👎 {item.label}
          </Chip>
        ))}
        {data.likes.length === 0 && data.dislikes.length === 0 && <Chip>no clear signal yet</Chip>}
      </div>
    </div>
  );
}

function ExclusionEditor({ data }: { data: HomeCookData }) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return INGREDIENTS.filter(
      (ingredient) =>
        ingredient.name.toLowerCase().includes(q) &&
        !data.preferences.excludedIngredients.includes(ingredient.id),
    ).slice(0, 6);
  }, [data.preferences.excludedIngredients, query]);

  return (
    <>
      <SectionTitle>Never in our food</SectionTitle>
      <div className="card">
        <input
          className="input"
          placeholder="Search an ingredient to exclude…"
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
                    apply((current) => toggleExcludedIngredient(current, ingredient.id));
                    setQuery('');
                  }}
                >
                  + {ingredient.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="chiprow">
          {data.preferences.excludedIngredients.length === 0 ? (
            <Chip>nothing excluded</Chip>
          ) : (
            data.preferences.excludedIngredients.map((id) => (
              <Chip key={id} tone="bad" active onClick={() => apply((c) => toggleExcludedIngredient(c, id))}>
                {getIngredient(id)?.name ?? id} ✕
              </Chip>
            ))
          )}
        </div>
        <p className="fineprint">
          Any recipe containing one of these is never recommended, whatever else is in its favour.
        </p>
      </div>
    </>
  );
}

function ImportPanel() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const run = (raw: string, filename = '') => {
    const outcome = importRecipes(raw, filename);
    if (!outcome.recipes.length) {
      setStatus(
        outcome.skipped.length
          ? `Nothing imported. ${outcome.skipped.slice(0, 2).join('; ')}`
          : "Nothing imported — HomeCook couldn't find a recipe in that.",
      );
      return;
    }
    apply((current) => applyImport(current, outcome));
    const plannable = outcome.recipes.filter((r) => r.planReady).length;
    setStatus(
      `Imported ${outcome.recipes.length} recipes — ${plannable} ready to plan, ` +
        `${outcome.recipes.length - plannable} kept as taste reference.` +
        (outcome.skipped.length ? ` ${outcome.skipped.length} blocks skipped.` : ''),
    );
    setText('');
  };

  return (
    <>
      <SectionTitle>Import recipe history</SectionTitle>
      <div className="card">
        <p>
          Paste old HelloFresh cards (or any recipe text), or load a .json / .csv file. HomeCook pulls
          out the ingredients, protein, cuisine and flavours, and feeds them into your taste profile.
        </p>
        <textarea
          className="input input--area"
          rows={6}
          placeholder={'Garlic Herb Chicken\nServes 2 | 30 min\nIngredients:\n2 chicken breasts\n1 tbsp olive oil\n…'}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Btn variant="primary" wide disabled={!text.trim()} onClick={() => run(text)}>
          Import pasted recipes
        </Btn>
        <input
          ref={fileInput}
          type="file"
          accept=".json,.csv,.txt,.md,text/plain,application/json"
          className="hidden-input"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            run(await file.text(), file.name);
            event.target.value = '';
          }}
        />
        <Btn wide onClick={() => fileInput.current?.click()}>
          Choose a file
        </Btn>
        {status && <p className="statusline">{status}</p>}
        <p className="fineprint">
          PDFs aren't supported yet — copy the text out of one and paste it here.
        </p>
      </div>
    </>
  );
}

function DataPanel({ data }: { data: HomeCookData }) {
  const [status, setStatus] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const download = () => {
    const blob = new Blob([exportData(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFilename();
    link.click();
    URL.revokeObjectURL(url);
    setStatus('Exported. Keep that file somewhere safe.');
  };

  return (
    <div className="card">
      <Btn wide onClick={download}>
        Export my data
      </Btn>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="hidden-input"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const result = importData(await file.text());
          event.target.value = '';
          if (!result.ok) {
            setStatus(result.error);
            return;
          }
          store.set(result.data);
          setStatus('Restored from backup.');
        }}
      />
      <Btn wide onClick={() => fileInput.current?.click()}>
        Import my data
      </Btn>
      {confirmReset ? (
        <div className="confirm">
          <p>Erase every recipe rating, pantry item and plan on this device?</p>
          <div className="confirm__actions">
            <Btn small variant="ghost" onClick={() => setConfirmReset(false)}>
              Keep it
            </Btn>
            <Btn
              small
              variant="danger"
              onClick={() => {
                store.set(resetEverything());
                setConfirmReset(false);
                setStatus('Everything reset.');
              }}
            >
              Erase everything
            </Btn>
          </div>
        </div>
      ) : (
        <Btn wide variant="danger" onClick={() => setConfirmReset(true)}>
          Reset HomeCook
        </Btn>
      )}
      {status && <p className="statusline">{status}</p>}
    </div>
  );
}
