// All fabricated fixture/demo data has been removed per the user's request.
// The app now starts with empty collections and shows only real, live data:
// - Job listings arrive exclusively from /api/search-jobs (live providers).
// - Tracker rows, weekly tasks, and walk-in stops entries are created by the
//   user through the UI and persisted in the user store / Cloud Firestore.
import { JobFixture, TrackerRow, WeeklyTask } from "../types";
import type { WalkInRouteStop } from "../components/ColumbusGoogleMap";

export const initialColumbusFixtures: JobFixture[] = [];

export const defaultTrackerRows: TrackerRow[] = [];

export const initialWeeklyTasks: WeeklyTask[] = [];

export const initialWalkInStops: WalkInRouteStop[] = [];
