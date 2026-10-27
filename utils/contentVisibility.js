'use strict';

// Participant-facing content rules. Administrative inventory reads stay separate.
const ROLES = new Set(['student-cspc', 'instructor', 'admin', 'guest']);
const NEWS_AUDIENCES = Object.freeze(['all', 'student-cspc', 'instructor', 'admin']);
const CAMPUS_WIDE = 'university-wide';

function normalizeContentRole(role) {
  const value = typeof role === 'string' ? role.trim() : '';
  return ROLES.has(value) ? value : '';
}

function canReadAnnouncements(role) {
  return normalizeContentRole(role) !== 'guest';
}

function eventReadScope(role) {
  const normalized = normalizeContentRole(role);
  return {
    audiences: normalized ? ['all', normalized] : ['all'],
    departmentCode: normalized === 'guest' ? CAMPUS_WIDE : null
  };
}

function eventReadSql(role) {
  const scope = eventReadScope(role);
  const clauses = [scope.audiences.length === 2 ? '(audience = ? OR audience = ?)' : 'audience = ?'];
  const params = scope.audiences.slice();
  if (scope.departmentCode !== null) {
    clauses.push('department_code = ?');
    params.push(scope.departmentCode);
  }
  return { sql: clauses.join(' AND '), params };
}

function canReadEvent(row, role) {
  if (!row) return false;
  const scope = eventReadScope(role);
  return scope.audiences.includes(row.audience)
    && (scope.departmentCode === null || row.department_code === scope.departmentCode);
}

module.exports = { NEWS_AUDIENCES, normalizeContentRole, canReadAnnouncements, eventReadScope, eventReadSql, canReadEvent };
