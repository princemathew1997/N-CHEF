-- Temporary write fence for a coordinated migration/deployment window.
-- Login, health and reads remain available. Inventory commands are atomic and
-- must insert a revision guard before any business writes.
CREATE TRIGGER IF NOT EXISTS release_maintenance_guard
BEFORE INSERT ON revision_guards
BEGIN
  SELECT RAISE(ABORT,'RELEASE_MAINTENANCE: inventory writes paused for upgrade');
END;
