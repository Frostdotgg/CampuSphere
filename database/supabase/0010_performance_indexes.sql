-- =============================================================================
-- 0010_performance_indexes.sql
-- Milestone 8, Section 8.8 follow-up — DB performance / indexing parity.
-- =============================================================================
-- Adds ONLY the indexes Supabase currently lacks, to match the MySQL indexes
-- introduced in database/schema.sql + database/seed.js for the order/filter read
-- paths the DB perf gate (scripts/db-perf-gate.js) checks. Indexes already
-- declared in 0001 (news_announcements_published_date_idx,
-- news_announcements_audience_idx, events_event_date_idx, faqs_display_order_idx,
-- campus_route_steps_route_id_step_order_idx, vr_hotspots_scene_id_idx, etc.) are
-- intentionally NOT repeated here.
--
-- Every statement is idempotent (IF NOT EXISTS) and additive (no table/data
-- changes), so this migration is safe to apply and re-apply.
--
-- APPLY: run this file in the Supabase SQL editor. Supabase SQL under
-- database/supabase/ is applied manually by the project owner; this file being
-- present is the static declaration. See the gate/report for live-apply status.
-- =============================================================================

-- users — admin list orders recent accounts by created_at, filters by role,
-- and updated_at parity with MySQL.
CREATE INDEX IF NOT EXISTS users_created_at_idx
    ON users (created_at DESC);
CREATE INDEX IF NOT EXISTS users_updated_at_idx
    ON users (updated_at);
CREATE INDEX IF NOT EXISTS users_role_idx
    ON users (role);

-- news_announcements — admin list orders by created_at; the dashboard filters
-- by audience and orders by published_date (composite covers WHERE + ORDER BY).
CREATE INDEX IF NOT EXISTS news_announcements_created_at_idx
    ON news_announcements (created_at DESC);
CREATE INDEX IF NOT EXISTS news_announcements_audience_published_date_idx
    ON news_announcements (audience, published_date DESC);

-- vr_scenes — scene browser/admin list orders by display_order, id.
CREATE INDEX IF NOT EXISTS vr_scenes_display_order_idx
    ON vr_scenes (display_order, id);

-- vr_hotspots — hotspots are read per scene ordered by display_order, id
-- (composite extends the existing single-column vr_hotspots_scene_id_idx).
CREATE INDEX IF NOT EXISTS vr_hotspots_scene_id_display_order_idx
    ON vr_hotspots (scene_id, display_order, id);

-- route_nodes — admin route-node list orders by display_order, id.
CREATE INDEX IF NOT EXISTS route_nodes_display_order_idx
    ON route_nodes (display_order, id);
