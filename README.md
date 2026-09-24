# HomeCook

A private, local-first meal planner and grocery assistant.

*Your meals. Your budget. Your kitchen.*

**Open it: https://scottyfncodes.github.io/homecook/** — mobile first,
installable to the iPhone home screen.

```
HOUSEHOLD → WEEK → SWAP / LOCK / GUESTS → GROCERY LIST → COOK → RATE
```

HomeCook answers one question: what are we cooking this week, what will it
cost, and what do we need to buy? Everything lives in the browser — no
account, no server, no analytics — and can be exported to a JSON file and
imported on another device.

## What it does

- **Household size is data, not a constant.** Adults, children and regular
  guests, and a per-meal headcount override for the night six people turn up.
  A one-off override never changes the household.
- **Recipes actually scale.** Quantities are recalculated from servings, and
  servings come from who is eating, the leftovers preference and any extra
  servings cooked on purpose.
- **Package-aware pricing.** Recipes need 2.5 lb of chicken; shops sell 1.5 lb
  packs. The grocery total is whole packages at the chosen store, and it is
  always labelled an estimate, never a checkout total.
- **The pantry is subtracted first**, with real quantities and unit
  conversion, before anything is priced.
- **One grocery list**, rebuilt from the plan every time the plan changes,
  grouped by aisle-ish category, with the meals each item is for — and one tap
  to share what's still to buy through the phone's share sheet (or the
  clipboard).
- **Swap and lock.** Locked meals survive a regenerate; swapping shows what it
  does to the week's basket before you commit.
- **A deterministic recommendation engine** — no model in the loop. Taste
  profile, your ratings, budget fit, pantry use, ingredient overlap, variety,
  recent meals and cooking time, each a scored component with a sentence
  attached, so "why HomeCook picked this" shows the actual arithmetic.
- **Hard exclusions are absolute.** A "never again" rating, an excluded
  ingredient, a protein you don't eat, or a dietary rule removes a recipe from
  consideration whatever else is in its favour.
- **Import old recipes** — pasted HelloFresh-style cards, CSV or JSON. The
  importer extracts ingredients, servings, times, protein, cuisine and flavour
  tags rather than storing the text, and feeds the taste profile. An
  ingredient the catalogue doesn't know becomes an honest "no price estimate"
  entry; a recipe that mostly fails to resolve is kept as a taste reference
  and marked as not plannable rather than pretending.

## Layout

```
index.html            page shell, PWA metadata
public/                manifest, service worker, generated icons
src/
  core/                types, persistence + sanitiser, actions, store
  data/                ingredient catalogue, recipe library, stores
  engine/              units, scaling, pricing, grocery, taste, planner, importer
  app/                 screens (Plan, Recipes, Grocery, Pantry, Profile)
  styles/
```

The engine (`src/engine/`) is plain TypeScript with no React in it, which is
why the behaviour — scaling, pantry subtraction, package maths, exclusions,
variety, budget repair — is testable without a browser. `tests/unit/` holds
those tests; `tests/e2e/` drives the real app at 390px with Playwright.

## Running it

```bash
npm install
npm run dev        # http://localhost:5174
npm run build       # typecheck + production build
npm run preview     # serve the build on :4173
npm test            # unit tests (engine, data integrity, persistence)
npm run e2e         # end-to-end tests at a phone viewport
```

Pull requests run `.github/workflows/ci.yml`: typecheck, the unit suite (in
UTC, Tokyo and Los Angeles, because planning days are local days), a
production build, and the end-to-end pass. Deployed to GitHub Pages by
`.github/workflows/deploy-pages.yml` on every push to `main`; the unit suite
has to pass before the site goes out.

## Deliberately not built yet

Live retailer prices, barcode scanning, PDF import, nutrition, aisle mapping,
expiry tracking, breakfast and lunch planning, multiple household profiles.
The data model leaves room for each; none of them are stubbed in the UI.
