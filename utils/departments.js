'use strict';

const DEPARTMENT_ADMIN = 'department-admin';
const UNIVERSITY_WIDE = 'university-wide';
const DEPARTMENTS = Object.freeze([
  { code: 'graduate-school', label: 'Graduate School' },
  { code: 'cea', label: 'College of Engineering and Architecture (CEA)' },
  { code: 'ccs', label: 'College of Computer Studies (CCS)' },
  { code: 'chs', label: 'College of Health Sciences (CHS)' },
  { code: 'cthbm', label: 'College of Tourism, Hospitality and Business Management (CTHBM)' },
  { code: 'ctde', label: 'College of Technological and Developmental Education (CTDE)' },
  { code: 'cas', label: 'College of Arts and Sciences (CAS)' }
].map(Object.freeze));
const CONTENT_DEPARTMENTS = Object.freeze([
  Object.freeze({ code: UNIVERSITY_WIDE, label: 'University-wide' }), ...DEPARTMENTS
]);
function isDepartment(code) {
  return typeof code === 'string' && DEPARTMENTS.some(d => d.code === code);
}
function isContentDepartment(code) {
  return typeof code === 'string' && CONTENT_DEPARTMENTS.some(d => d.code === code);
}
function departmentLabel(code) {
  return (CONTENT_DEPARTMENTS.find(d => d.code === code) || CONTENT_DEPARTMENTS[0]).label;
}
function homeForUser(user) {
  return user && user.role === DEPARTMENT_ADMIN ? '/admin/news'
    : user && user.role === 'admin' ? '/admin' : '/dashboard';
}
module.exports = { DEPARTMENT_ADMIN, UNIVERSITY_WIDE, DEPARTMENTS, CONTENT_DEPARTMENTS,
  isDepartment, isContentDepartment, departmentLabel, homeForUser };
