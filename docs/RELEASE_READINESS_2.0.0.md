# N-CHEF 2.0.0 release readiness

Validated 20 October 2026. Code is ready for review and merge. Production has not
been migrated or deployed, and no existing data has been deleted.

## Validation

- 44 JavaScript/API tests passed, including permissions, concurrent writes,
  idempotent actions, stock accounting, CSV validation/import and release guards.
- 6 SQLite/database tests passed, including preservation of accounts, sessions,
  assignments, existing balances and already-issued requests during migration.
- The upgrade was also rehearsed in memory on a private export of the actual
  production D1 database. Migrations 0006–0008 passed, with all compared existing
  records, credentials, assignments, balances and history preserved. Foreign-key
  checks returned zero errors before and after. The export remains Git-ignored
  and must never be attached to a PR or public release.
- The 2.0.0 build and Wrangler Worker packaging dry run passed. Bindings resolve
  to `DB (nchef-db)` and `ASSETS`. No deploy was performed by the dry run.
- Migration checksums passed, including comparison with the current committed
  base. Existing migration files were not modified.
- Desktop/mobile browser QA passed for all four role dashboards, user/catalog
  setup, receipt prices, invoice comparison, catalog sync preserving form input,
  approval, vendor orders, distribution, rejection/resolution, CSV template and
  error downloads, whole-file validation, preview and import.
- Release review also corrected stock-link permissions when switching roles in
  one browser, mobile operation-page titles and the bulk-stock submenu state.
  Health now rejects a database lacking the required operations schema.

## Production prerequisites

Read-only remote inspection found these pending migrations on `nchef-db`:

1. `0006_operations.sql`: role mapping, managed lists, prices and operation records.
2. `0007_role_titles.sql`: displayed role titles.
3. `0008_preserve_issued_requests.sql`: prevent issuing old approved requests again.

**A reset is unnecessary.** Merge first after CI passes, then use a maintenance
window to pause writes, preserve a private recovery point, apply and verify these
migrations, and publish the matching **v2.0.0** API/frontend pair. Refresh clients,
verify role workflows and assign new Purchaser accounts before reopening.

At validation the source changes awaited committing/merging; production release tooling
requires a clean checkout at fetched `origin/main`. A development build containing
uncommitted changes is not a production release artifact. Remote preflight will
correctly refuse deployment while the migrations remain pending.

Database epoch `operations-v2` prevents code-only rollback to v1.x after migration.
Use a forward fix or a separately coordinated database-and-code recovery. See
[the operations upgrade runbook](RELEASING.md#version-200-operations-upgrade) for
the exact migration and release sequence. Current instructions are the Markdown
role guides; existing v1 illustrated PDFs are not v2 release deliverables.

For another private migration rehearsal before deployment:

```powershell
python scripts/rehearse-migrations.py .wrangler/private-production-export.sql
```

The script works on an in-memory copy and never connects to production. Supply
an export taken before the operations upgrade and keep it outside version control.
