-- Owner-applied additive migration. Back up first; MySQL DDL commits implicitly.
-- Run once after confirming the target schema. No accounts are created.
ALTER TABLE users
  MODIFY role ENUM('student-cspc', 'instructor', 'admin', 'guest', 'department-admin') NOT NULL DEFAULT 'guest',
  ADD COLUMN department_code VARCHAR(30) NULL,
  ADD CONSTRAINT chk_users_department_code CHECK ((role = 'department-admin' AND department_code IS NOT NULL AND department_code IN ('graduate-school','cea','ccs','chs','cthbm','ctde','cas')) OR (role <> 'department-admin' AND department_code IS NULL));
ALTER TABLE news_announcements
  ADD COLUMN department_code VARCHAR(30) NOT NULL DEFAULT 'university-wide',
  ADD CONSTRAINT chk_news_announcements_department_code CHECK (department_code IN ('university-wide','graduate-school','cea','ccs','chs','cthbm','ctde','cas'));
ALTER TABLE events
  ADD COLUMN department_code VARCHAR(30) NOT NULL DEFAULT 'university-wide',
  ADD CONSTRAINT chk_events_department_code CHECK (department_code IN ('university-wide','graduate-school','cea','ccs','chs','cthbm','ctde','cas'));
