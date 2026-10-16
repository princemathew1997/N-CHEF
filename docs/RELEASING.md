# N-CHEF releases and rollback

Production releases are manual. The first managed version is **v1.0.0**;
`package.json` is the version source and `package-lock.json` must match. Merging
a PR runs validation but does not publish production. A version badge in the
sidebar, `/release.json`, and `/api/health` identify the deployed application.

## One-time activation

1. Merge this release-tooling change into `main` after CI passes.
2. In GitHub repository Settings > Environments, create `production`, restrict
   deployments to `main`, and add the people who may approve production changes
   as required reviewers. Reviewers are a repository setting, not enforced by YAML.
3. Create an account-scoped Cloudflare API token for the account in
   `release.config.json`. Grant Cloudflare Pages Edit, Workers Scripts Edit and
   D1 Read. The API permission labels are Pages Write, Workers Scripts Write and
   D1 Read. This release tool only queries migration names; it does not need D1
   Write for a schema change. If the account restricts binding/deployment access,
   use the failed preflight's permission error to identify an additional required
   read scope rather than granting an unrestricted global API key.
4. Store that token as the **environment secret** `CLOUDFLARE_API_TOKEN` in
   `production`. Do not paste it into chat, source, command arguments or a release.
   GitHub's built-in token handles tags and release assets; no GitHub PAT is needed.
5. Leave Cloudflare automatic production builds disabled. The current Pages
   project uses Direct Upload. Do not add a separate Worker Git build or another
   deploy workflow; it would bypass the shared release/rollback lock. The tool
   also refuses Pages Git integration with automatic production builds enabled.
6. Review the target account, Worker, Pages project, D1 database and public URL
   in `release.config.json`. They must match the Wrangler configuration.

No release, tag, production deployment or database restore is performed simply
by installing this tooling. At initial inspection the live deployment was the
older `8d23156` build; a newer Git commit must not be labeled live without a
verified production deployment record.

## Publish v1.0.0

1. Open GitHub Actions > **Publish release** > Run workflow.
2. Choose branch `main` and enter `v1.0.0`.
3. Review and approve the production environment job when GitHub requests it.
4. Wait for the workflow to finish. Do not cancel it while production is changing.
5. Open the published GitHub Release. Its `release.json` must say `healthy`.
6. Refresh the app and confirm the displayed version, login, outlet access,
   Master Orders and a normal operational workflow. The automated smoke check
   verifies database connectivity and matching frontend/API version and commit;
   it is not a substitute for role-specific operational checks.

The workflow validates the version and clean source checkout, performs remote
preflight, and reserves a new draft release for that exact commit. It then runs
JavaScript/API tests, SQLite tests, the build and a Worker dry-run package check.
Before changing production, it captures the current deployment pair. It deploys
the API followed by Pages from the same source revision. Only after deployment
IDs and public health/version checks pass is the draft release published.

The operation uses the pinned project Wrangler, an explicit account and production
branch, and structured Wrangler deployment output. It does not parse human-readable
deployment logs for identifiers. Deployments use the existing database and service
bindings; no resources are provisioned or migrated by the release commands.

## Release records

Each GitHub Release stores these non-secret JSON assets:

| Asset | Meaning |
| --- | --- |
| `operation.json` | Attempted version, commit and start time |
| `before.json` | Exact Worker version and successful Pages deployment before publishing, with database migration fingerprint |
| `release.json` | New deployment pair, source version/commit, schema fingerprint, and `healthy`, `failed` or `in-progress` status |
| `rollback-<run-id>.json` | Audit trail for a later rollback, including each component restored and the outcome |

Failed attempts stay as drafts with any available recovery records. A failed
record is never a valid normal rollback target. If failure happens before the
snapshot is written, the release has not started production mutation. A failed
deployment can leave only one component updated: use the **previous-snapshot**
recovery below. There is no unattended automatic rollback or database restore.

Do not reuse, move or delete published version tags. A later failure fix gets
a new version. Failed draft attempts also remain available for incident review;
do not overwrite their assets. Workflows also retain JSON records as workflow
artifacts for 90 days. If release-asset upload fails after deployment, download
the workflow artifact and preserve its records for recovery. If both uploads fail,
preserve the runner's `dist/releases/` files before ending the incident. Do not
call the release successful until its records are saved.

Release assets contain deployment IDs, schema filenames/checksums and source
metadata. Never upload D1 exports, customer data, `.dev.vars` or credentials.

## Roll back to a published version

Example: v1.0.1 is faulty and v1.0.0 was healthy.

1. Open GitHub Actions > **Roll back release** > Run workflow on `main`.
2. Enter **v1.0.0**, the version you want to restore.
3. Choose target **release** and approve the production environment job.
4. Wait for success, then refresh browser clients and perform the operational
   checks listed above. The app and API should report v1.0.0 again.

The job downloads v1.0.0's release record and checks its source commit against
the Git tag. It verifies both recorded Cloudflare targets exist, the Pages target
is a successful production deployment (not a preview), its service binding points
to the correct API, and the Worker version points to the expected D1 database.
It restores the exact Worker version and Pages deployment and verifies both IDs,
health and version. It does not move `main` backward or create a replacement release.

The currently broken application does not have to pass its health check to
start rollback. Cloudflare control-plane access and the target D1 migration
metadata must still be available. A provider rejection is reported; the tool
does not force a rollback past secret or binding safety checks.

**Customer records and stock transactions remain in the current database.**
Only application deployments change. Rollback is manual and may briefly leave a
mixed pair while the second component changes. Managed API versions reject
business writes from stale or mismatched browser builds with HTTP 409 and a
refresh instruction. Reads, login and setup remain available. This guard first
exists in the managed v1.0.0 API; an older pre-versioning recovery target cannot
provide this additional protection. Refresh all clients after that recovery.

If the job fails partway through, its rollback audit says which component was
restored. Do not assume the entire pair is healthy. Resolve the provider error
and rerun the same target; restoration to the same recorded IDs is repeatable.

## Recover from a failed or first managed release

1. Choose **Roll back release** on `main`.
2. Enter the **failed version**, for example v1.0.0, whose draft release contains
   the pre-deployment snapshot.
3. Choose target **previous-snapshot**.

This restores `before.json` from that release, including a legacy deployment
that did not yet expose version metadata. For a legacy snapshot the final check
uses the exact provider deployment IDs and API health; there is no old frontend
version endpoint to compare. The same database compatibility and binding checks
still apply. The record is a recovery snapshot, not a claim that the legacy build
was previously published under the new version number.

## Prepare the next version

On a normal development branch:

```powershell
npm version patch --no-git-tag-version
```

Use `minor` for a compatible feature or `major` for a breaking change. Update
`CHANGELOG.md`, commit the version/lockfile/changes, open a PR and merge it after
validation. Then manually run Publish release with the matching version. The
workflow creates the GitHub Release/tag; do not tag an unshipped commit locally
and present it as a published release.

For local inspection:

```powershell
npm run release:check
npm run release:check -- --version v1.0.1 --remote
npm run release:deploy -- --version v1.0.1
npm run release:rollback -- --manifest .wrangler/rollback/release.json
```

`--remote` performs read-only production preflight and requires the Cloudflare
token in the environment. Deploy/rollback commands without `--execute` only
describe their target and make no production changes. Deployment additionally
requires a clean committed checkout at fetched `origin/main`. Prefer the GitHub
workflows for all mutations so their shared concurrency lock, draft release,
record upload and environment approval are used. Direct local `--execute`
commands do not acquire GitHub's lock; an operator must ensure no other release
is running and preserve/upload the resulting records manually.

The old `deploy:pages` frontend-only shortcut now stops with a pointer to this
guide. Do not bypass coordinated release bookkeeping with ad hoc production
Wrangler deployment commands.

## Database changes and rollback boundaries

- Migration files are immutable. `migrations.lock.json` records SHA-256 checksums
  using normalized LF line endings so Windows and Linux agree. CI compares
  existing SQL files against the PR base as well as the lockfile.
- Add a new SQL file for a schema change, then run
  `node scripts/check-migrations.mjs --update` to append its checksum. This command
  refuses edits/deletions of existing locked migrations.
- Release preflight requires the applied D1 migration names to match the source
  release exactly. It stops for pending or unexpected migrations instead of
  applying them automatically.
- For an intentional schema change, schedule maintenance, pause inventory entry,
  take a private D1 backup/recovery bookmark, review backward compatibility, apply
  the migration separately, then publish the compatible API/frontend pair. Do not
  upload that backup to GitHub Release assets. See the existing database guide.
- Increment `databaseEpoch` in `release.config.json` when database/record semantics
  become incompatible, even without a schema migration. Use expand/contract changes
  when possible to preserve a rollback window.
- Normal rollback requires the same database epoch and exact applied migration
  set/checksums as its target. It refuses older incompatible schemas, missing
  deployments and mismatched accounts, databases or service bindings.
  Recovery snapshots retain the previous application's schema fingerprint;
  applying a new migration does not make that older application safe to restore.
- D1 Time Travel or backup restoration is a separate incident procedure. It can
  remove transactions recorded after the recovery point. Coordinate the matching
  code versions, stop writes and reconcile those transactions before reopening.
  This tool never resets D1 or removes its migrations to make code rollback pass.
- Code rollback does not undo already-sent orders, messages or other external
  side effects. Review such actions separately during incident recovery.

Cloudflare can expire or remove old deployment versions; existence is verified
before rollback. If a target is unavailable, publish a tested forward fix or
perform a separately reviewed re-deployment from its source. Never guess a
replacement deployment ID or label a newer build as the old immutable release.

## References

- [Worker rollback behavior and limitations](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
- [Pages production rollback targets](https://developers.cloudflare.com/pages/configuration/rollbacks/)
- [Worker deployment API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/deployments/methods/create/)
- [Pages rollback API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/rollback/)
- [D1 query permissions](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/)
