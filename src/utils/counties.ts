/**
 * Front-end county visibility.
 *
 * Hidden counties still exist in Supabase (scrapers may write them) but must
 * not appear in the SPA: cases list, county chips, analytics, realtime inserts.
 *
 * Client request 2026-08-26: remove Pima from the front end.
 */
export const HIDDEN_FRONTEND_COUNTIES = new Set(['pima']);

/** PostgREST `.or()` clause: null county (legacy Maricopa) OR not a hidden county */
export const VISIBLE_COUNTY_OR_FILTER =
  'county.is.null,county.neq.pima';

export function isHiddenCounty(county: string | null | undefined): boolean {
  if (!county) return false;
  return HIDDEN_FRONTEND_COUNTIES.has(county.toLowerCase());
}

export function excludeHiddenCounties<T extends { county?: string | null }>(
  rows: T[]
): T[] {
  return rows.filter((r) => !isHiddenCounty(r.county));
}
