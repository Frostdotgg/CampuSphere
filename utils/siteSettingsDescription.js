'use strict';

/*
 * The public About page keeps its original two-paragraph layout while the
 * existing school_description setting supplies both narrative blocks.  This
 * module is deliberately pure so the admin API, public projection, and tests
 * apply the same newline and paragraph rules without touching a database.
 */

const SCHOOL_DESCRIPTION_MAX_LENGTH = 2000;
const LEGACY_SCHOOL_DESCRIPTION = 'Camarines Sur Polytechnic Colleges is a state-funded institution of higher learning in Nabua, Camarines Sur providing quality education in engineering, technology, and other disciplines.';
const DEFAULT_SCHOOL_CONTEXT = 'As the campus expands to accommodate growing academic programs and an increasing student body, the need for efficient campus management and navigation has become more vital than ever. CampuSphere acts as a digital twin to this dynamic physical environment.';
const DEFAULT_SCHOOL_DESCRIPTION = `${LEGACY_SCHOOL_DESCRIPTION}\n\n${DEFAULT_SCHOOL_CONTEXT}`;

function normalizeLineEndings(value) {
  return value.replace(/\r\n?/g, '\n').trim();
}

function splitSchoolDescription(value) {
  const normalized = normalizeLineEndings(String(value || ''));
  if (!normalized) return [];
  return normalized
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function canonicalizeSchoolDescription(raw) {
  if (typeof raw !== 'string') {
    return { ok: false, message: 'Description is required.' };
  }

  const normalized = normalizeLineEndings(raw);
  if (!normalized) return { ok: false, message: 'Description is required.' };
  if (normalized.length > SCHOOL_DESCRIPTION_MAX_LENGTH) {
    return {
      ok: false,
      message: `Description must be ${SCHOOL_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
    };
  }

  const blocks = splitSchoolDescription(normalized);
  if (blocks.length > 2) {
    return {
      ok: false,
      message: 'Description may contain at most two paragraphs separated by one blank line.',
    };
  }

  const value = blocks.join('\n\n');
  return { ok: true, value, blocks };
}

function expandLegacySchoolDescription(raw) {
  const parsed = canonicalizeSchoolDescription(raw);
  if (!parsed.ok) return '';
  return parsed.value === LEGACY_SCHOOL_DESCRIPTION
    ? DEFAULT_SCHOOL_DESCRIPTION
    : parsed.value;
}

module.exports = {
  SCHOOL_DESCRIPTION_MAX_LENGTH,
  LEGACY_SCHOOL_DESCRIPTION,
  DEFAULT_SCHOOL_CONTEXT,
  DEFAULT_SCHOOL_DESCRIPTION,
  splitSchoolDescription,
  canonicalizeSchoolDescription,
  expandLegacySchoolDescription,
};
