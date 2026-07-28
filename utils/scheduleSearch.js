'use strict';

/* ========================================
   CampuSphere — Schedule search encoders (M12.P1-D4)

   Pure, server-only helpers for the bounded Room Schedule text search (`q`).
   No DB, no req/res, no logging, no secrets. Two concerns:

     1. normalizeSearchQuery — accept only a single scalar string, trim it,
        treat blank as "no search", cap it at SEARCH_MAX characters, and
        reject an array / repeated / non-scalar value with a FIXED sanitized
        message that never echoes the submitted value.

     2. Metacharacter encoding — the same user text must match LITERALLY in
        both backends. A user's `%`, `_`, `*`, `,`, `(`, `)`, `"`, or `\`
        must never widen the match or alter filter grammar.

   Encoding model (verified empirically against the live backends, not assumed):

     MySQL  — one layer. The pattern is a bound parameter, so only the SQL
              LIKE metacharacters need escaping: \ % _ using backslash, which
              is already MySQL's default LIKE escape character (no explicit
              ESCAPE clause, which would break under NO_BACKSLASH_ESCAPES).
              Escaping an ordinary character is a no-op, so the escape set is
              safe to apply blindly.

     Supabase/PostgREST — TWO layers, because the value is embedded in a
              PostgREST filter expression string:
                a. LIKE layer:      \ % _ -> backslash-escaped.
                b. PostgREST quoted-string layer: the value is wrapped in
                   double quotes and every \ is doubled and every " escaped,
                   which is what contains , ( ) . " and \.
              Measured behaviour that fixes this design: inside a quoted
              .or() value a LIKE escape needs TWO backslashes to survive the
              unquote (one backslash is consumed and the wildcard still
              matches everything), while a STANDALONE .ilike() value needs
              exactly one. The two encoders below reflect that difference.

   The asterisk is a special case, established by measurement against a row
   that genuinely contains one: PostgREST aliases `*` to `%` in like/ilike
   values, and it does so even when the asterisk is backslash-escaped. So an
   escaped `\*` does not become a literal asterisk — it becomes a literal
   PERCENT, which silently matches the WRONG rows, while an unescaped `*`
   widens the match to everything. Neither is acceptable, and LIKE offers no
   third escape. The asterisk is therefore mapped to the single-character
   wildcard `_`, which yields a strict SUPERSET of the intended match (never a
   subset, because `*` is exactly one character), and the caller narrows that
   superset back to an exact literal match in JavaScript via
   matchesScheduleSearch. MySQL needs none of this: `*` is an ordinary
   character to SQL LIKE, so its path stays exact and server-side.

   That JavaScript narrowing is bounded (SEARCH_SCAN_MAX/SEARCH_SCAN_PAGES). A
   scan that cannot prove it exhausted the candidate set never returns a
   partial answer dressed up as exact — the repository fails closed instead.
   ======================================== */

const SEARCH_MAX = 100;

// Fixed sanitized messages. They never include the submitted value.
const SEARCH_INVALID_MESSAGE = 'Invalid search query.';
const SEARCH_TOO_LONG_MESSAGE = `Search text must be ${SEARCH_MAX} characters or fewer.`;

/**
 * Validate + normalize the optional `q` list filter.
 *
 * Express parses a repeated `?q=a&q=b` into an ARRAY, which must fail closed
 * rather than silently using one element. Objects (`?q[x]=1`) fail the same
 * way.
 *
 * @returns {{ok:true, value:(string|null)}|{ok:false, message:string}}
 *   value === null means "no search filter".
 */
function normalizeSearchQuery(raw) {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  // Single scalar string only: arrays (repeated params) and objects fail closed.
  if (typeof raw !== 'string') return { ok: false, message: SEARCH_INVALID_MESSAGE };
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: null };
  if (trimmed.length > SEARCH_MAX) return { ok: false, message: SEARCH_TOO_LONG_MESSAGE };
  return { ok: true, value: trimmed };
}

/* ---------------- MySQL ---------------- */

// Escape the SQL LIKE metacharacters. Order matters: the backslash first, so
// the escapes introduced afterwards are not themselves re-escaped.
function escapeMysqlLikeLiteral(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Case-insensitive contains-pattern for a bound MySQL parameter. The pattern
 * is lowercased so the query can compare LOWER(column) and stay
 * case-insensitive regardless of the column collation; lowercasing cannot
 * disturb the \ % _ escapes.
 */
function mysqlLikePattern(q) {
  return '%' + escapeMysqlLikeLiteral(String(q).toLowerCase()) + '%';
}

/* ---------------- Supabase / PostgREST ---------------- */

/**
 * LIKE layer for PostgREST. Escapes \ % _ so they match literally, then maps
 * any remaining `*` to the single-character wildcard `_` (see the header note:
 * a literal asterisk is not expressible through PostgREST ilike). The order is
 * load-bearing — the user's own `_` is escaped to `\_` BEFORE the asterisk
 * substitution introduces an unescaped `_`, so the two never collide.
 */
function escapePostgrestLikeLiteral(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/\*/g, '_');
}

/**
 * True when the Supabase pattern for `q` is only a SUPERSET of the intended
 * literal match and must be narrowed exactly in JavaScript.
 */
function searchNeedsExactPostFilter(q) {
  return typeof q === 'string' && q.indexOf('*') !== -1;
}

/**
 * Contains-pattern for a STANDALONE supabase-js filter such as
 * .ilike('name', pattern). supabase-js encodes the value as a query
 * parameter, so exactly one escape layer applies.
 */
function supabaseIlikePattern(q) {
  return '%' + escapePostgrestLikeLiteral(q) + '%';
}

/**
 * Wrap a value for use INSIDE a PostgREST filter expression (.or(...)).
 * Double quotes contain the reserved characters , ( ) . : ; every backslash
 * is doubled and every double quote escaped so the quoted string cannot be
 * terminated early and no extra disjunct can be injected.
 */
function postgrestQuoteValue(value) {
  const escaped = String(value === undefined || value === null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
  return '"' + escaped + '"';
}

/**
 * Fully encoded, quoted contains-pattern for use inside .or(). Applies the
 * LIKE layer first and the PostgREST quoted-string layer second, which is why
 * a literal % arrives at Postgres as the two-backslash form proven to match
 * literally rather than as a wildcard.
 */
function supabaseOrIlikeValue(q) {
  return postgrestQuoteValue(supabaseIlikePattern(q));
}

/**
 * Build the complete .or() expression for the schedule text search.
 *
 * @param {string} q normalized search text
 * @param {number[]} buildingIds building ids whose NAME matched q, resolved by
 *   a separate standalone .ilike() query. Only positive integers produced by
 *   this server are interpolated, so the in.(...) list carries no user text.
 */
function supabaseScheduleOrExpression(q, buildingIds) {
  const value = supabaseOrIlikeValue(q);
  const parts = [
    'title.ilike.' + value,
    'location_label.ilike.' + value,
    'floor_label.ilike.' + value,
    'description.ilike.' + value,
  ];
  const ids = (Array.isArray(buildingIds) ? buildingIds : [])
    .filter((n) => Number.isInteger(n) && n > 0);
  // An empty in.() list is invalid PostgREST, so the disjunct is added only
  // when at least one building name actually matched.
  if (ids.length > 0) parts.push('building_id.in.(' + ids.join(',') + ')');
  return parts.join(',');
}

/* ---------------- exact match semantics ---------------- */

// The columns the search covers, in the shaped schedule row.
const SEARCHED_FIELDS = [
  'title', 'building_name', 'location_label', 'floor_label', 'description',
];

// Page size for the candidate scan used when a superset query has to be
// narrowed in JavaScript, and the maximum number of pages that scan may walk.
// The scan pages until a SHORT page proves the candidate set is exhausted. It
// is NOT guaranteed to reach exhaustion: if the final permitted page is still
// full, exhaustion is unproven and the caller FAILS CLOSED with the bounded
// search error rather than returning a partial result as if it were exact.
const SEARCH_SCAN_MAX = 1000;
const SEARCH_SCAN_PAGES = 20;

/**
 * The single definition of "this schedule row matches this search text":
 * a case-insensitive LITERAL substring of any searched field. Both backends
 * are held to exactly this behaviour — MySQL and the Supabase ilike path
 * reproduce it in SQL, and the asterisk post-filter applies it directly.
 */
function matchesScheduleSearch(row, q) {
  if (typeof q !== 'string' || q.trim() === '') return true;
  if (!row || typeof row !== 'object') return false;
  const needle = q.trim().toLowerCase();
  for (const field of SEARCHED_FIELDS) {
    const value = row[field];
    if (value === undefined || value === null) continue;
    if (String(value).toLowerCase().indexOf(needle) !== -1) return true;
  }
  return false;
}

module.exports = {
  SEARCH_MAX,
  SEARCH_SCAN_MAX,
  SEARCH_SCAN_PAGES,
  SEARCHED_FIELDS,
  SEARCH_INVALID_MESSAGE,
  SEARCH_TOO_LONG_MESSAGE,
  normalizeSearchQuery,
  escapeMysqlLikeLiteral,
  mysqlLikePattern,
  escapePostgrestLikeLiteral,
  searchNeedsExactPostFilter,
  supabaseIlikePattern,
  postgrestQuoteValue,
  supabaseOrIlikeValue,
  supabaseScheduleOrExpression,
  matchesScheduleSearch,
};
