# JSON restore safety

The application keeps JSON metadata in the existing localStorage keys listed in
`DATA_KEYS`, plus `kijun_hist_*` history keys. Certificate bodies remain Blobs in
`dentalAdminTraining_isolated_v1`, version 1, store `dentalAdminTrainingCertificates`
(key path `id`, index `recordId`). Existing legacy stores are retained unchanged.

## Legacy-tab isolation

Before application startup, `version-storage.js` copies the native legacy values
into `dental_isolated_v1:` localStorage keys and all legacy file bodies into the
separate certificate DB. The application receives a Storage-compatible facade;
its logical keys and JSON format stay unchanged. A durable control row in
`dentalAdminIsolation_v1` owns the activation decision independently of localStorage
markers. It is written only after the strict file transaction, destination checks
and stable-source metadata checks succeed. A `copied` row retains prepared
metadata until application startup completes; restart can replay it before any UI
is enabled. `active` stores are never cleared or recopied from a stale legacy tab.
Migration errors remove partial prefixed metadata while retaining original data.
Legacy inline attachments move losslessly into Blobs instead of doubling their
base64 storage in localStorage. Deterministic migration IDs make retries bounded.

Legacy code writes only its original keys and DB, so neither stale ledger saves
nor old certificate deletes affect this release. A storage-event warning reports
legacy saves; their values remain in legacy storage and are not auto-merged.
The original-source fingerprint is checked again at startup, so legacy edits are
reported even if no new-version tab was open when they occurred.
This is protection against known older app behavior, not a security boundary
against hostile same-origin code or an explicit browser "clear site data" action.
The reviewed old release has no localStorage.clear or IndexedDB-delete-all path.
Missing referenced bodies in the active store block startup rather than silently
appearing as a new empty installation. Migration requires additional quota.

IndexedDB and localStorage do not share a transaction. Restoration therefore uses
copy-on-write file bodies and a durable undo journal, rather than overwriting
existing files and relying on an in-memory catch block.

1. Validate the entire JSON, supported key types, record IDs, attendee references,
   attachment references, base64 bodies and the 20 MiB per-file limit. Resolve old
   inline certificate formats without modifying storage. Reject incomplete backups
   rather than silently linking an unrelated local file.
2. Require an exclusive Web Lock. Running application tabs hold shared session
   locks, so other tabs must close before restoration. Disable the initiating UI.
3. Save the exact previous raw value (including absence) of every affected
   localStorage key and its prepared new value in `dentalAdminRestore_isolated_v1`, version 1, store `journal`, key
   `active`, phase `prepared`. Use strict IndexedDB transaction durability.
4. Stage all imported file bodies in one transaction, with new unpredictable
   storage IDs and `restoreOperationId`. Preserve logical certificate IDs and
   remap only their storage references. Use `add`, never replace an existing body.
5. Write all prepared metadata. Persist journal phase `committed` only after every
   write succeeds. Delete the journal after commitment and reload the application.

Before loading **any application data or UI scripts**, the bootstrap inspects the
journal. A `prepared` operation is undone: remove only the affected keys to free
quota, restore their exact previous values, then delete only staging bodies whose
operation marker matches. A `committed` operation replays the prepared new values
if localStorage is incomplete, then removes its journal. Both paths are retryable
if the browser closes again.

If rollback itself fails, the journal is retained and startup remains blocked.
Close other tabs, free disk/browser capacity without clearing this site's data,
and reload. Do not delete IndexedDB/localStorage to resolve a recovery warning.
There is no success message until the commit-marker transaction completes. A
post-commit journal-cleanup failure is reported and retried at next startup.

## Compatibility and limits

- The existing certificate DB schema stays at version 1 and remains intact; this
  release copies into a separate version-1 DB. The journal is also separate.
  An unfinished pre-isolation journal is recovered against the original stores
  before the first migration. Raw localStorage values are copied without re-encoding.
- Legacy inline files and string/numeric certificate or training IDs are supported.
  Incomplete backups containing references without bodies are rejected unchanged.
- An intentionally empty facility ledger remains empty after a reload; defaults
  are initialized only when the ledger key does not exist.
- Existing file bodies, including superseded bodies, are retained. Staged bodies
  are removed on rollback; committed bodies are referenced by the new metadata.
  Repeated restores can increase disk usage. Backups and available disk space
  should be checked before manual cleanup of old data.
- Staging and journaling require extra disk space; insufficient capacity causes
  failure without discarding the original data. localStorage rollback may require
  a restart if browser writes remain unavailable.
- Web Locks coordinate tabs running this version. Older tabs use separate stores;
  their later edits require an explicit reviewed JSON import. Close old tabs to
  avoid confusion and avoid editing site storage through developer tools.
- A user clearing site storage, disk corruption or power-loss guarantees beyond
  browser/OS durability are outside this mechanism. Keep external JSON backups.
- Fixtures and fault injection run in temporary Chrome profiles. No real clinic
  data, user browser profiles, cloud storage or external file transmission is used.

Partial JSON imports validate the final merged attendee/record graph under the
exclusive lock, after any inline migration has completed. Retained records are
checked when only an attendee master is imported, and retained attendees are
checked when only training records are imported. Legacy names are resolved in
memory and any newly created attendee rows join the same journaled update.

## Release and rollback

The release is based on main `e2ad9ee75e20d97b2501920bbd3094f8b209e6cb` and
retains the r0809 manifest and dataset. GitHub Pages builds repository root on
main via its generated Pages workflow. Application script URLs have a shared
release cache key to prevent old file-store code mixing with the new loader.

Do not roll back the HTML to a pre-isolation release after users have migrated:
that code reads retained legacy data, not newer isolated data, and cannot recover
new journals. Prefer a forward safety patch retaining the isolation and recovery
loaders, temporarily disabling imports if required. Code rollback does not restore
browser records. Recover pending journals with the matching engine, then use a
verified complete JSON backup for an intentional data rollback.

## Verification

Set `NODE_PATH` to the installed Playwright module directory and run:

```powershell
node tests/training-certificates.cjs
node tests/backup-restore.cjs
node tests/acceptance.cjs
node tests/version-storage.cjs
```

The safety suite compares all raw localStorage keys and SHA-256 hashes of stored
Blobs. It covers malformed/missing files and references, ID collisions, failed
journal/file/metadata/commit writes, actual localStorage quota exhaustion,
multi-tab exclusion, retry after persistent rollback failure, forced termination
of the isolated Chrome process before commit, post-commit cleanup retry, legacy
backups and restart persistence. The normal suite exercises PDF/JPG/PNG uploads,
preview, byte-identical downloads, multiple attendees/files, edit/delete and JSON
export/import. Unrelated external parsers and startup update checks are isolated
from these persistence tests.
