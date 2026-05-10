-- Safe migration for existing databases:
-- removes student_profiles columns if they still exist.

USE campusphere_db;

SET @db := DATABASE();

SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = @db AND table_name = 'student_profiles' AND column_name = 'section'
    ),
    'ALTER TABLE student_profiles DROP COLUMN section',
    'SELECT "section already removed"'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = @db AND table_name = 'student_profiles' AND column_name = 'status'
    ),
    'ALTER TABLE student_profiles DROP COLUMN status',
    'SELECT "status already removed"'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = @db AND table_name = 'student_profiles' AND column_name = 'assigned_room'
    ),
    'ALTER TABLE student_profiles DROP COLUMN assigned_room',
    'SELECT "assigned_room already removed"'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = @db AND table_name = 'student_profiles' AND column_name = 'gwa'
    ),
    'ALTER TABLE student_profiles DROP COLUMN gwa',
    'SELECT "gwa already removed"'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
