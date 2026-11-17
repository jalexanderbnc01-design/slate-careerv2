# Firestore Security Specification

## 1. Data Invariants
1. Every user document lives strictly under `/users/{uid}/...` and belongs to the authenticated, email-verified user whose `request.auth.uid == uid`.
2. Every document across `jobs`, `groups`, `comments`, `tracker`, `leads`, `searchCache`, and `settings` MUST carry `uid == uid`, `createdAt == request.time` on creation, `updatedAt == request.time` on create/update, and `version` (`1` on create, `existing().version + 1` on update).
3. A `JobComment` under `/users/{uid}/jobs/{jobId}/comments/{commentId}` cannot be created unless its parent job `/users/{uid}/jobs/{jobId}` exists (`exists(...)`) and `incoming().jobId == jobId`.
4. All document IDs (`uid`, `jobId`, `groupId`, `commentId`, `entryId`, `leadId`, `key`, `docId`) MUST match `^[a-zA-Z0-9_\-]+$` with max length 128.
5. `uid` and `createdAt` are immutable after document creation.
6. Every collection enforces strict `hasAll` + `hasOnly` allowlists on create and `affectedKeys().hasOnly(...)` on update, plus string/array size limits to prevent resource exhaustion and shadow-field injection.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Cross-user read**: Authenticated user `alice` reads `/users/bob/jobs/job-1` -> `PERMISSION_DENIED`.
2. **Cross-user list**: Authenticated user `alice` lists `/users/bob/leads` -> `PERMISSION_DENIED`.
3. **Unauthenticated read/write**: Signed-out request to `/users/alice/tracker/entry-1` -> `PERMISSION_DENIED`.
4. **Unverified email write**: Authenticated user with `email_verified: false` attempts to create `/users/alice/jobs/job-1` -> `PERMISSION_DENIED`.
5. **Identity spoofing**: `alice` creates `/users/alice/jobs/job-1` with `{ uid: "bob", ... }` -> `PERMISSION_DENIED`.
6. **Shadow / ghost field injection**: `alice` creates `/users/alice/leads/lead-1` with extra `{ isAdmin: true }` -> `PERMISSION_DENIED`.
7. **Orphaned comment**: `alice` creates `/users/alice/jobs/nonexistent-job/comments/c-1` -> `PERMISSION_DENIED`.
8. **ID poisoning**: `alice` writes `/users/alice/jobs/bad$id..with..dots` or >128 chars -> `PERMISSION_DENIED`.
9. **Client timestamp forgery**: `alice` creates `/users/alice/tracker/entry-1` with a hardcoded past `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
10. **Version regression / stale overwrite**: `alice` updates `/users/alice/jobs/job-1` (currently `version: 2`) with `{ version: 2 }` or `{ version: 99 }` instead of `3` -> `PERMISSION_DENIED`.
11. **Immutable field mutation**: `alice` updates `/users/alice/groups/grp-1` trying to alter `createdAt` or `uid` -> `PERMISSION_DENIED`.
12. **Unbounded array / oversized string**: `alice` creates `/users/alice/leads/lead-1` with a 50KB `title` or 500-element `matchedSkills` array -> `PERMISSION_DENIED`.
