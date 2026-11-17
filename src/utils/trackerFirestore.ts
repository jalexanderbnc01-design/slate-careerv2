import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/client";

export type TrackerStage =
  | "Saved"
  | "Applying"
  | "Applied"
  | "Interviewing"
  | "Offer"
  | "Rejected";

export interface TrackerComment {
  id: string;
  text: string;
  at: string;
}

export interface TrackerGroup {
  id: string;
  name: string;
  color: string;
  collapsed: boolean;
}

export interface TrackerJob {
  id: string;
  company: string;
  role: string;
  stage: TrackerStage;
  pay: number;
  loc: string;
  group: string;
  comments: TrackerComment[];
  isExample?: boolean;
}

export interface TrackerState {
  groups: TrackerGroup[];
  jobs: TrackerJob[];
}

const TRACKER_STAGES: TrackerStage[] = [
  "Saved",
  "Applying",
  "Applied",
  "Interviewing",
  "Offer",
  "Rejected",
];

function sanitizeId(raw: string, prefix: string): string {
  const cleaned = String(raw || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
  return cleaned || `${prefix}_${Date.now().toString(36)}`;
}

function clampStage(stage: unknown): TrackerStage {
  return TRACKER_STAGES.includes(stage as TrackerStage)
    ? (stage as TrackerStage)
    : "Saved";
}

function clampPay(pay: unknown): number {
  const num = typeof pay === "number" && Number.isFinite(pay) ? pay : 0;
  return Math.min(10000, Math.max(0, Math.round(num)));
}

function clampText(raw: unknown, maxLen: number): string {
  return String(raw ?? "")
    .slice(0, maxLen)
    .trim();
}



export async function trackerCollectionsAreEmpty(uid: string): Promise<boolean> {
  const [groupsSnap, jobsSnap] = await Promise.all([
    getDocs(collection(db, "users", uid, "groups")),
    getDocs(collection(db, "users", uid, "jobs")),
  ]);
  return groupsSnap.empty && jobsSnap.empty;
}

export async function importTrackerRailState(
  uid: string,
  state: TrackerState
): Promise<void> {
  if (!(await trackerCollectionsAreEmpty(uid))) return;

  const batch = writeBatch(db);
  const now = serverTimestamp();

  state.groups.forEach((group, index) => {
    const ref = doc(db, "users", uid, "groups", sanitizeId(group.id, "grp"));
    batch.set(ref, {
      uid,
      name: clampText(group.name, 120) || "Group",
      color: clampText(group.color, 32) || "#19543e",
      collapsed: Boolean(group.collapsed),
      order: index,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
  });

  state.jobs.forEach((job, index) => {
    const jobId = sanitizeId(job.id, "job");
    const ref = doc(db, "users", uid, "jobs", jobId);
    batch.set(ref, {
      uid,
      company: clampText(job.company, 200) || "Untitled",
      role: clampText(job.role, 200),
      stage: clampStage(job.stage),
      pay: clampPay(job.pay),
      location: clampText(job.loc, 200),
      groupId: job.group ? sanitizeId(job.group, "grp") : "",
      order: index,
      isExample: Boolean(job.isExample),
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    (job.comments || []).forEach((comment) => {
      const commentRef = doc(
        db,
        "users",
        uid,
        "jobs",
        jobId,
        "comments",
        sanitizeId(comment.id, "cm")
      );
      batch.set(commentRef, {
        uid,
        jobId,
        text: clampText(comment.text, 2000) || "(empty)",
        createdAt: now,
        updatedAt: now,
        version: 1,
      });
    });
  });

  await batch.commit();
}

export function subscribeTracker(
  uid: string,
  onData: (state: TrackerState) => void,
  onError?: (err: unknown) => void
): () => void {
  let groups: TrackerGroup[] = [];
  let jobs: TrackerJob[] = [];
  let commentsByJob = new Map<string, TrackerComment[]>();
  let groupsLoaded = false;
  let jobsLoaded = false;
  let commentsLoaded = false;

  const emit = () => {
    if (!groupsLoaded || !jobsLoaded || !commentsLoaded) return;
    onData({
      groups: groups.map((group) => ({ ...group })),
      jobs: jobs.map((job) => ({
        ...job,
        comments: commentsByJob.get(job.id) || [],
      })),
    });
  };

  const unsubGroups = onSnapshot(
    query(collection(db, "users", uid, "groups"), orderBy("order", "asc")),
    (snap) => {
      groups = snap.docs.map((d) => {
        const data = d.data() as Record<string, any>;
        return {
          id: d.id,
          name: typeof data.name === "string" ? data.name : "Group",
          color: typeof data.color === "string" ? data.color : "#19543e",
          collapsed: Boolean(data.collapsed),
        };
      });
      groupsLoaded = true;
      emit();
    },
    (err) => onError?.(err)
  );

  const unsubJobs = onSnapshot(
    query(collection(db, "users", uid, "jobs"), orderBy("order", "asc")),
    (snap) => {
      jobs = snap.docs.map((d) => {
        const data = d.data() as Record<string, any>;
        return {
          id: d.id,
          company: typeof data.company === "string" ? data.company : "Untitled",
          role: typeof data.role === "string" ? data.role : "",
          stage: clampStage(data.stage),
          pay: clampPay(data.pay),
          loc: typeof data.location === "string" ? data.location : "",
          group: typeof data.groupId === "string" ? data.groupId : "",
          isExample: Boolean(data.isExample),
          comments: [],
        };
      });
      jobsLoaded = true;
      emit();
    },
    (err) => onError?.(err)
  );

  const unsubComments = onSnapshot(
    collectionGroup(db, "comments"),
    (snap) => {
      commentsByJob = new Map<string, TrackerComment[]>();
      snap.forEach((d) => {
        const data = d.data() as Record<string, any>;
        const pathParts = d.ref.path.split("/");
        const jobId = pathParts.length >= 4 ? pathParts[3] : "";
        if (!jobId) return;
        const list = commentsByJob.get(jobId) || [];
        list.push({
          id: d.id,
          text: typeof data.text === "string" ? data.text : "",
          at: typeof data.at === "string" ? data.at : "",
        });
        commentsByJob.set(jobId, list);
      });
      commentsLoaded = true;
      emit();
    },
    (err) => onError?.(err)
  );

  return () => {
    unsubGroups();
    unsubJobs();
    unsubComments();
  };
}

export interface RemoteTrackerIds {
  groupIds: Set<string>;
  jobIds: Set<string>;
  commentIds: Map<string, Set<string>>;
}

export function captureRemoteTrackerIds(state: TrackerState): RemoteTrackerIds {
  return {
    groupIds: new Set(state.groups.map((g) => g.id)),
    jobIds: new Set(state.jobs.map((j) => j.id)),
    commentIds: new Map(
      state.jobs.map((j) => [
        j.id,
        new Set((j.comments || []).map((c) => c.id)),
      ])
    ),
  };
}

export async function syncTrackerState(
  uid: string,
  state: TrackerState,
  remote: RemoteTrackerIds
): Promise<RemoteTrackerIds> {
  const batch = writeBatch(db);
  const now = serverTimestamp();
  let ops = 0;

  const nextIds: RemoteTrackerIds = {
    groupIds: new Set(),
    jobIds: new Set(),
    commentIds: new Map(),
  };

  for (const group of state.groups) {
    const id = sanitizeId(group.id, "grp");
    nextIds.groupIds.add(id);
    const ref = doc(db, "users", uid, "groups", id);
    const fields = {
      name: clampText(group.name, 120) || "Group",
      color: clampText(group.color, 32) || "#19543e",
      collapsed: Boolean(group.collapsed),
      order: Math.max(0, state.groups.indexOf(group)),
    };
    if (remote.groupIds.has(id)) {
      batch.update(ref, { ...fields, updatedAt: now, version: increment(1) });
    } else {
      batch.set(ref, {
        uid,
        ...fields,
        createdAt: now,
        updatedAt: now,
        version: 1,
      });
    }
    ops += 1;
  }

  for (const job of state.jobs) {
    const id = sanitizeId(job.id, "job");
    nextIds.jobIds.add(id);
    const ref = doc(db, "users", uid, "jobs", id);
    const fields = {
      company: clampText(job.company, 200) || "Untitled",
      role: clampText(job.role, 200),
      stage: clampStage(job.stage),
      pay: clampPay(job.pay),
      location: clampText(job.loc, 200),
      groupId: job.group ? sanitizeId(job.group, "grp") : "",
      order: Math.max(0, state.jobs.indexOf(job)),
      isExample: Boolean(job.isExample),
    };
    if (remote.jobIds.has(id)) {
      batch.update(ref, { ...fields, updatedAt: now, version: increment(1) });
    } else {
      batch.set(ref, {
        uid,
        ...fields,
        createdAt: now,
        updatedAt: now,
        version: 1,
      });
    }
    ops += 1;

    const nextCommentIds = new Set<string>();
    for (const comment of job.comments || []) {
      const commentId = sanitizeId(comment.id, "cm");
      nextCommentIds.add(commentId);
      const commentRef = doc(db, "users", uid, "jobs", id, "comments", commentId);
      const commentFields = {
        text: clampText(comment.text, 2000) || "(empty)",
      };
      const remoteComments = remote.commentIds.get(id) || new Set<string>();
      if (remoteComments.has(commentId)) {
        batch.update(commentRef, {
          ...commentFields,
          updatedAt: now,
          version: increment(1),
        });
      } else {
        batch.set(commentRef, {
          uid,
          jobId: id,
          ...commentFields,
          createdAt: now,
          updatedAt: now,
          version: 1,
        });
      }
      ops += 1;
    }
    nextIds.commentIds.set(id, nextCommentIds);

    const remoteComments = remote.commentIds.get(id) || new Set<string>();
    for (const commentId of remoteComments) {
      if (!nextCommentIds.has(commentId)) {
        batch.delete(doc(db, "users", uid, "jobs", id, "comments", commentId));
        ops += 1;
      }
    }
  }

  for (const groupId of remote.groupIds) {
    if (!nextIds.groupIds.has(groupId)) {
      batch.delete(doc(db, "users", uid, "groups", groupId));
      ops += 1;
    }
  }

  for (const [jobId, commentIds] of remote.commentIds) {
    if (nextIds.jobIds.has(jobId)) continue;
    for (const commentId of commentIds) {
      batch.delete(doc(db, "users", uid, "jobs", jobId, "comments", commentId));
      ops += 1;
    }
  }

  for (const jobId of remote.jobIds) {
    if (!nextIds.jobIds.has(jobId)) {
      batch.delete(doc(db, "users", uid, "jobs", jobId));
      ops += 1;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }
  return nextIds;
}
