# Slate Module Registry

Details the modular files and directories powering the **Career Application Builder** system.

## Module Details

### 1. Model Schema Definitions
- **Path**: `/src/types.ts`
- **Purpose**: Fully structures profile specifications, checklist pipeline matrices, and save formats.

### 2. Standard Background profile
- **Path**: `/src/defaultProfile.ts`
- **Purpose**: Feeds default Outside Plant (OSP) Civil utility drafting specifications.

### 3. App View Container
- **Path**: `/src/App.tsx`
- **Purpose**: Core layout engine with dashboard controls.

### 4. Job Analysis View
- **Path**: `/src/components/AnalysisViewer.tsx`
- **Purpose**: Interactive match score ring and keywords tagging lists.

### 5. Resume Builder Layout
- **Path**: `/src/components/ResumeViewer.tsx`
- **Purpose**: Formats printable resume documents with click-to-edit capabilities.

### 6. Cover Letter Builder Layout
- **Path**: `/src/components/CoverLetterViewer.tsx`
- **Purpose**: Implements custom tone letterheads.

### 7. Task Checklist
- **Path**: `/src/components/ChecklistViewer.tsx`
- **Purpose**: Generates checkpoints.

### 8. Session Note Notepad
- **Path**: `/src/components/NotesSection.tsx`
- **Purpose**: Quick copy notepad workspace.

### 9. Saved Packets
- **Path**: `/src/components/SavedPacketsList.tsx`
- **Purpose**: Local database cataloger.

### 10. Technical Bio Facts Editor
- **Path**: `/src/components/ProfileEditor.tsx`
- **Purpose**: Tailor structural bio facts.

### 11. Firestore User Store
- **Path**: `/src/utils/userStore.ts`
- **Purpose**: Firestore-backed key/value store replacing legacy localStorage blobs under `users/{uid}/settings`.

### 12. Legacy Migration Importer
- **Path**: `/src/utils/firestoreMigration.ts`
- **Purpose**: One-time import of localStorage and server runtime JSON into Firestore.

### 13. Tracker Firestore Layer
- **Path**: `/src/utils/trackerFirestore.ts`
- **Purpose**: Real-time jobs/groups/comments subscriptions and reconciled writes for the JobTrackerRail.

### 14. Portfolio Cloud Storage
- **Path**: `/src/utils/portfolioStorage.ts`
- **Purpose**: Upload/download/delete proof assets in Cloud Storage under `users/{uid}/portfolio`.
