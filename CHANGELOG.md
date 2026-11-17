# Changelog

All notable changes to the **Career Application Builder** project are documented below.

## [1.1.0] - Firestore Persistence Migration

### Added
- **Firestore-Backed User Store (`src/utils/userStore.ts`)**: Every legacy localStorage blob now persists as a versioned document under `users/{uid}/settings/{key}` with the exact same string payload semantics, hydrated from Firestore on sign-in and written atomically in the background.
- **One-Time Migration Importer (`src/utils/firestoreMigration.ts`)**: First sign-in copies all 18 legacy localStorage keys into Firestore, imports `job-tracker-rail-v1` into structured `groups`/`jobs`/`comments` collections, triggers the server-side legacy JSON import, then retires the old localStorage keys.
- **Server Legacy Import Endpoint (`POST /api/migration/import-legacy`)**: Imports `.clay-runtime.json`, `.notion-runtime.json`, and `.slate-ai-runtime.json` (if present on ephemeral disk) into Firestore once per user via the Admin SDK.
- **Tracker Firestore Layer (`src/utils/trackerFirestore.ts`)**: Real-time `onSnapshot` subscription, batched reconcile writes, and echo suppression for the JobTrackerRail jobs/groups/comments collections.
- **Portfolio Cloud Storage (`src/utils/portfolioStorage.ts` + PortfolioProofTab)**: Real file uploads (PDF, images, .dwg, .zip) to `users/{uid}/portfolio/...` with download links and delete support, replacing the simulated `window.alert` download.
- **Authenticated API Surface**: All `/api/*` user routes (AI, Notion, jobs search, maps config, builders) now require a verified Firebase ID Bearer token; the Express server derives `uid` exclusively from the decoded token.

### Changed
- **Notion & AI Server Stores**: `server/notion/service.ts` and `server/ai/store.ts` no longer write `.notion-runtime.json` / `.slate-ai-runtime.json`; they hydrate from and persist to `users/{uid}/settings/notion_runtime` and `users/{uid}/settings/ai_runtime`.
- **Search Cache**: Live job search cache reads/writes `users/{uid}/searchCache` documents with TTL expiry instead of the in-memory Map.
- **Static Prototypes**: Job Feed and GridForge iframes no longer touch localStorage; feed/workspace state is bridged through `postMessage` and persisted by the React parent in Firestore.
- **Client Fetches**: All API calls attach Firebase Auth Bearer tokens via `authFetch`.

### Fixed
- **Missing React Type Definitions**: Added `@types/react` / `@types/react-dom` to devDependencies so `npm run lint` (tsc) type-checks class components and hooks correctly.
- **SettingsAPIs Draft State Bug**: `setDrafts({...draft})` spread the wrong object, clobbering other providers' drafts; now spreads the full `drafts` map.
- **ColumbusJobFinder Prop Types**: `style` is optional in `onImportJob`/`onInstantAnalyze` callbacks, matching the actual job fixtures.

## [1.0.0] - 2026-06-03

### Added
- **Full-Stack Express Server (`server.ts`)**: Built safe, secure server endpoint to query `@google/genai` (utilizing standard `gemini-3.5-flash` model) and proxy client requests keeping the `GEMINI_API_KEY` hidden from the dashboard.
- **Client Frontend (`src/App.tsx`)**: Modularized React 19 interface showcasing three pane layout (Core Inputs, Center generated documents, Right action panel).
- **Core Models Types (`src/types.ts`)**: Rigorous, type-checked contract definitions for Career background profiles, AI extracted listings, Match scoring, and persistence packets.
- **Resume Tailoring Previewer (`src/components/ResumeViewer.tsx`)**: Interactive printable layout that mirrors high-contrast paper drafts with instant in-line edits on sections.
- **Tailored Letter Blueprint (`src/components/CoverLetterViewer.tsx`)**: Customized letterheads featuring tone controls, target matching, and copy commands.
- **Application Roadmap Tracker (`src/components/ChecklistViewer.tsx`)**: Automatically customizable 10-tier checkpoints with custom task additions.
- **Match Score Dashboard (`src/components/AnalysisViewer.tsx`)**: circular Job Fit rating with keywords tagging, softwares, flags, and alignment tips.
- **Workspace Notepad (`src/components/NotesSection.tsx`)**: Easy-to-use temporary work notepad.
- **Baseline Profile Facts (`src/components/ProfileEditor.tsx`)**: Integrated editable baseline containing default OSP Civil drafting and technical technician specifications.
- **Saved Application Packets List (`src/components/SavedPacketsList.tsx`)**: Syncs and browsers active or historical pipelines from browser `localStorage`.
