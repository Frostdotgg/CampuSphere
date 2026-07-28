'use strict';

/**
 * Serialize a value to JSON that is safe to embed inside an HTML <script>
 * context (including <script type="application/json"> blocks and JS string
 * literals consumed by the client).
 *
 * Escapes the characters that can prematurely close a script element or
 * break out of a JS string:
 *   <       prevents "</script>" breakout
 *   >       defense-in-depth (blocks "]]>" / comment tricks)
 *   &       defense-in-depth
 *   U+2028  LINE SEPARATOR (valid in JSON, but breaks JS string literals)
 *   U+2029  PARAGRAPH SEPARATOR (same)
 *
 * Each replacement is a valid JSON \uXXXX sequence, so JSON.parse() on the
 * client restores the original characters losslessly. Use with EJS unescaped
 * output:
 *   <script id="x" type="application/json"><%- safeJson(value) %></script>
 *
 * @param {*} value Any JSON-serializable value.
 * @returns {string} Safe JSON string ("null" when value is undefined).
 */

// Built from code points so no literal control/line-separator characters
// live in this source file: < > & U+2028 U+2029.
const UNSAFE_CHARS = new RegExp(
  '[<>&' + String.fromCharCode(0x2028) + String.fromCharCode(0x2029) + ']',
  'g'
);

function escapeChar(ch) {
  return '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
}

function safeJson(value) {
  const json = JSON.stringify(value);
  if (json === undefined) {
    return 'null';
  }
  return json.replace(UNSAFE_CHARS, escapeChar);
}

module.exports = safeJson;
