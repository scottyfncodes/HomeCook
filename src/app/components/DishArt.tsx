import type { ReactNode } from 'react';
import type { MealFormat } from '@homecook/core/types';

/**
 * One small drawing per kind of dish, in the same hand as the pot on the
 * first screen. The line is the ink colour; the filled shape is the food, in
 * the one warm colour the app keeps for cooking.
 */
const ART: Record<MealFormat, ReactNode> = {
  bowls: (
    <>
      <path className="dish__food" d="M11 24c2-6 7-9 13-9s11 3 13 9z" />
      <path d="M6 24h36a18 15 0 0 1-36 0z" />
      <path d="M18 39h12" />
      <path d="M29 6l-8 16M35 8l-9 14" />
    </>
  ),
  tacos: (
    <>
      <path className="dish__food" d="M11 29c1-6 4-9 7-9 1-3 4-4 6-3 2-2 5-2 7 1 3 0 5 2 6 5 2 1 2 4 1 6z" />
      <path d="M6 36a18 18 0 0 1 36 0z" />
      <path d="M4 40h40" />
    </>
  ),
  pasta: (
    <>
      <ellipse cx="24" cy="31" rx="19" ry="8" />
      <path className="dish__food" d="M14 29c0-6 5-9 10-9s10 3 10 9c-3 2-6 3-10 3s-7-1-10-3z" />
      <path d="M18 27c2-3 9-3 11 0M20 23c2-1 6-1 8 1" />
      <path d="M38 8v12M35 8v6M41 8v6M35 14c0 3 6 3 6 0" />
    </>
  ),
  skillet: (
    <>
      <circle cx="20" cy="26" r="14" />
      <path d="M34 26h11" />
      <circle className="dish__food" cx="15" cy="23" r="4" />
      <circle className="dish__food" cx="24" cy="30" r="4.5" />
      <circle className="dish__food" cx="24" cy="20" r="2.5" />
    </>
  ),
  'sheet-pan': (
    <>
      <path d="M4 34l6-16h28l6 16z" />
      <path d="M4 34v3h40v-3" />
      <rect className="dish__food" x="12" y="21" width="8" height="6" rx="2" />
      <circle className="dish__food" cx="27" cy="24" r="3.2" />
      <rect className="dish__food" x="30" y="27" width="7" height="4.5" rx="2" />
      <circle className="dish__food" cx="17" cy="30" r="2.6" />
    </>
  ),
  soup: (
    <>
      <path d="M17 13c-2-3 2-5 0-8M24 13c-2-3 2-5 0-8M31 13c-2-3 2-5 0-8" />
      <path className="dish__food" d="M8 22h32c0 2-1 4-2 5H10c-1-1-2-3-2-5z" />
      <path d="M6 22h36a18 16 0 0 1-36 0z" />
      <path d="M36 21l8-9" />
    </>
  ),
  curry: (
    <>
      <path d="M19 12c-2-3 2-5 0-8M27 12c-2-3 2-5 0-8" />
      <path className="dish__food" d="M9 21h30c-1 3-2 5-4 6H13c-2-1-3-3-4-6z" />
      <path d="M7 21h34c-1 10-8 16-17 16S8 31 7 21z" />
      <path d="M7 24H3M41 24h4" />
      <path d="M17 41h14" />
    </>
  ),
  sandwich: (
    <>
      <path d="M7 20c0-6 8-9 17-9s17 3 17 9z" />
      <path className="dish__food" d="M6 24c3-2 6 2 9 0s6 2 9 0 6 2 9 0 6 2 9 0v4H6z" />
      <path d="M7 31h34v3a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4z" />
    </>
  ),
  roast: (
    <>
      <path className="dish__food" d="M12 30c0-9 6-15 12-15s12 6 12 15z" />
      <path d="M20 19c2 2 2 5 0 8M27 18c2 2 2 5 0 8" />
      <path d="M4 30h40c-2 5-10 8-20 8S6 35 4 30z" />
    </>
  ),
  salad: (
    <>
      <path className="dish__food" d="M10 24c0-5 3-8 7-8 1-4 5-6 9-5 3-2 8 0 9 4 3 1 4 5 3 9z" />
      <path d="M20 16c1 3 0 6-2 8M30 14c0 4-2 7-4 10" />
      <path d="M6 24h36a18 15 0 0 1-36 0z" />
      <path d="M18 39h12" />
    </>
  ),
  'stir-fry': (
    <>
      <path className="dish__food" d="M12 26c2-4 6-6 12-6s10 2 12 6z" />
      <path d="M6 26h32a16 12 0 0 1-32 0z" />
      <path d="M38 27l8-3" />
      <path d="M15 12c2-3 5-3 6 0M26 9c2-3 5-3 6 0" />
    </>
  ),
  bake: (
    <>
      <path className="dish__food" d="M9 23c2-3 4-3 6 0s4 3 6 0 4-3 6 0 4 3 6 0 4-3 6 0v3H9z" />
      <path d="M7 23h34v11a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4z" />
      <path d="M7 27H3M41 27h4" />
      <path d="M18 15c-2-3 2-5 0-8M30 15c-2-3 2-5 0-8" />
    </>
  ),
};

export function DishArt({ format, size = 44 }: { format: MealFormat; size?: number }) {
  return (
    <svg
      className="dish"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ART[format] ?? ART.bowls}
    </svg>
  );
}
