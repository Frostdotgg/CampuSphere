'use strict';

/*
 * Shared account-identity name resolver.
 *
 * Google is the authority for names on OAuth-linked student, guest, and
 * instructor accounts.  Keep the precedence and formatting in one small,
 * dependency-free helper so the MySQL and Supabase creation/login paths cannot
 * drift apart:
 *
 *   1. verified Google given/family claims;
 *   2. verified Google full-name claim;
 *   3. a readable name derived from the normalized email prefix.
 *
 * The resolver never reads configuration, a session, or a database and never
 * logs its inputs.  firstName/lastName are bounded to the existing users table
 * columns; fullName is the display form of those bounded parts.
 */

const MAX_NAME_PART_LENGTH = 50;

function normalizeWhitespace(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstNonBlank(...values) {
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (normalized) return normalized;
  }
  return '';
}

function capPart(value) {
  return normalizeWhitespace(value).slice(0, MAX_NAME_PART_LENGTH).trim();
}

function splitName(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return { firstName: '', lastName: '' };
  const parts = normalized.split(' ');
  return {
    firstName: capPart(parts[0]),
    lastName: capPart(parts.slice(1).join(' '))
  };
}

function titleCaseEmailToken(token) {
  if (!token) return '';
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function nameFromEmail(email) {
  const normalizedEmail = normalizeWhitespace(email).toLowerCase();
  const at = normalizedEmail.indexOf('@');
  const localPart = (at >= 0 ? normalizedEmail.slice(0, at) : normalizedEmail)
    .split('+', 1)[0]
    .replace(/[._-]+/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, ' ');
  const tokens = normalizeWhitespace(localPart)
    .split(' ')
    .filter(Boolean)
    .map(titleCaseEmailToken);
  return tokens.join(' ');
}

function buildResult(parts, source) {
  const firstName = capPart(parts.firstName);
  const lastName = capPart(parts.lastName);
  const fullName = normalizeWhitespace([firstName, lastName].filter(Boolean).join(' '));
  return {
    firstName,
    lastName,
    first_name: firstName,
    last_name: lastName,
    fullName,
    source
  };
}

/**
 * Resolve a display/database name from verified identity claims.
 *
 * Both camelCase and Google/user-row snake_case claim names are accepted so
 * callers can pass the provider response or a pending/session-shaped object.
 * The returned object always contains a non-empty name (the final `User`
 * fallback protects the NOT NULL database columns for malformed test claims).
 */
function resolveAccountIdentityName(identity) {
  const input = identity || {};
  const given = firstNonBlank(input.givenName, input.given_name);
  const family = firstNonBlank(input.familyName, input.family_name);
  if (given || family) {
    return buildResult({ firstName: given || family, lastName: given ? family : '' }, 'google-given-family');
  }

  const googleFullName = firstNonBlank(input.fullName, input.name);
  if (googleFullName) {
    return buildResult(splitName(googleFullName), 'google-full-name');
  }

  const emailName = nameFromEmail(input.email);
  if (emailName) return buildResult(splitName(emailName), 'email-prefix');
  return buildResult({ firstName: 'User', lastName: '' }, 'safe-fallback');
}

module.exports = {
  MAX_NAME_PART_LENGTH,
  normalizeWhitespace,
  resolveAccountIdentityName,
  // Short alias for callers/tests that use the domain term directly.
  resolveIdentityName: resolveAccountIdentityName
};
