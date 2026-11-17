# SyncScribe — Test Notes

Results of the verification checks in the Implementation Plan. Newest first.

## 12.3 — Two users editing the same document offline (PRD 4.5)

**Date:** 2026-11-17 · **Result:** Pass

**How it was run:** `apps/server/src/collab/offlineMerge.test.ts` (part of `npm test`), against the real sync server (Express + Hocuspocus + SQLite) on a local port. Two separate accounts, Priya and Ali, each with their own Yjs document kept while disconnected, as the app keeps it in IndexedDB. Ali was added to Priya's workspace as an editor directly in the database, because the sharing screens are built in Step 13.

**Steps (PRD 4.5):**

1. Priya's "Group Report" contains:
   ```
   # Introduction
   This report is about rivers. Our projcet studies floods.
   ```
   Both users have it on their devices.
2. Both go offline. Priya rewrites the first sentence of the Introduction. Ali fixes the typo "projcet" and adds a Conclusion. Both also type at the exact same spot, right after the heading.
3. Priya reconnects first; her changes upload.
4. Ali reconnects; his changes upload and merge.

**Merged document (identical for both users and for a third device that opens it afterwards):**

```
# Introduction (Priya) (Ali)
Rivers shape how cities grow. Our project studies floods.
# Conclusion
Floods can be predicted.
```

**Acceptance check:**

- No text from either user lost: Priya's new sentence, Ali's typo fix and Ali's Conclusion are all present. ✔
- Text typed at the same spot by both is kept side by side, in the same order for everyone. ✔
- Both users end with byte-for-byte identical content. ✔
- No dialog: merging is automatic. ✔

**Not covered yet:**

- Step 7 of the workflow (version history shows each person's contribution) depends on Step 16 and Step 20.8.
- Two real browsers with the sharing UI: re-run by hand once Step 13 is done, and append the result here.
