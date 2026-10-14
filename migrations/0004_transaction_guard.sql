-- Remove local prototype triggers, if present. Remote 0003 never included them.
DROP TRIGGER IF EXISTS command_revision_guard;
DROP TRIGGER IF EXISTS command_revision_advance;
CREATE UNIQUE INDEX app_revision_version_idx ON app_revision(revision);
-- Inserting a guard for a stale revision fails the foreign key and aborts the
-- entire D1 batch. Delete the guard before advancing the revision in that batch.
CREATE TABLE revision_guards (
  command_id TEXT PRIMARY KEY,
  expected_revision INTEGER NOT NULL REFERENCES app_revision(revision)
);
