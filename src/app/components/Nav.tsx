import type { ReactNode } from 'react';

export type Tab = 'plan' | 'recipes' | 'grocery' | 'pantry' | 'profile';

const ICONS: Record<Tab, ReactNode> = {
  plan: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  recipes: (
    <>
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  grocery: (
    <>
      <path d="M4 6h3l2.2 9.2a2 2 0 0 0 2 1.5h6.1a2 2 0 0 0 2-1.5L21 9H7" />
      <circle cx="11" cy="20" r="1.2" />
      <circle cx="18" cy="20" r="1.2" />
    </>
  ),
  pantry: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <path d="M4 12h16M10 7.5h1M10 16h1" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
};

const LABELS: Record<Tab, string> = {
  plan: 'Plan',
  recipes: 'Recipes',
  grocery: 'Grocery',
  pantry: 'Pantry',
  profile: 'Profile',
};

export function Nav({
  tab,
  onChange,
  badge,
}: {
  tab: Tab;
  onChange: (tab: Tab) => void;
  badge?: Partial<Record<Tab, number>>;
}) {
  return (
    <nav className="nav" aria-label="Main">
      {(Object.keys(LABELS) as Tab[]).map((key) => {
        const count = badge?.[key] ?? 0;
        return (
          <button
            key={key}
            type="button"
            className={`nav__tab ${tab === key ? 'nav__tab--on' : ''}`}
            onClick={() => onChange(key)}
            aria-current={tab === key ? 'page' : undefined}
          >
            <span className="nav__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[key]}
              </svg>
              {count > 0 && <span className="nav__badge">{count}</span>}
            </span>
            {LABELS[key]}
          </button>
        );
      })}
    </nav>
  );
}
