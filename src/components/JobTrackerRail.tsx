import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  captureRemoteTrackerIds,
  subscribeTracker,
  syncTrackerState,
  trackerCollectionsAreEmpty,
  type RemoteTrackerIds,
} from '../utils/trackerFirestore';

export type TrackerStage =
  | 'Saved'
  | 'Applying'
  | 'Applied'
  | 'Interviewing'
  | 'Offer'
  | 'Rejected';

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

interface TrackerState {
  groups: TrackerGroup[];
  jobs: TrackerJob[];
}

const PALETTE = [
  '#19543e',
  '#d97706',
  '#2563eb',
  '#db2777',
  '#7c3aed',
  '#0d9488',
  '#e11d48',
  '#65a30d',
];

const STAGES: TrackerStage[] = [
  'Saved',
  'Applying',
  'Applied',
  'Interviewing',
  'Offer',
  'Rejected',
];

const STAGE_DOT_CLASS: Record<TrackerStage, string> = {
  Saved: 'dot-saved',
  Applying: 'dot-warn',
  Applied: 'dot-acc',
  Interviewing: 'dot-good',
  Offer: 'dot-good',
  Rejected: 'dot-bad',
};

function makeUid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function nowHm(): string {
  const d = new Date();
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

function formatPay(k: number): string {
  return k > 0 ? `$${k}K/yr` : 'no pay';
}

function createSeedState(): TrackerState {
  const colGroup: TrackerGroup = {
    id: 'grp-columbus-seed',
    name: 'Columbus',
    color: PALETTE[0],
    collapsed: false,
  };
  const remGroup: TrackerGroup = {
    id: 'grp-remote-seed',
    name: 'Remote',
    color: PALETTE[1],
    collapsed: false,
  };
  return {
    groups: [colGroup, remGroup],
    jobs: [
      {
        id: 'job-burgess-seed',
        company: 'Burgess & Niple (example)',
        role: 'BIM Coordinator',
        stage: 'Interviewing',
        pay: 84,
        loc: 'Columbus, OH',
        group: colGroup.id,
        isExample: true,
        comments: [
          {
            id: 'cm-burgess-1',
            text: 'Panel interview Thursday. Bring the Civil 3D sample.',
            at: '16:20',
          },
        ],
      },
      {
        id: 'job-lumen-seed',
        company: 'Studio Lumen (example)',
        role: '3D Visualization Artist',
        stage: 'Applied',
        pay: 52,
        loc: 'Columbus, OH',
        group: colGroup.id,
        isExample: true,
        comments: [],
      },
      {
        id: 'job-adobe-seed',
        company: 'Adobe (example)',
        role: 'Sr Designer, Frame.io',
        stage: 'Saved',
        pay: 150,
        loc: 'Remote',
        group: remGroup.id,
        isExample: true,
        comments: [
          {
            id: 'cm-adobe-1',
            text: 'Tailor the motion reel before applying.',
            at: '09:12',
          },
        ],
      },
      {
        id: 'job-timely-seed',
        company: 'TimelyCare (example)',
        role: 'Senior Product Designer',
        stage: 'Applying',
        pay: 114,
        loc: 'Remote',
        group: remGroup.id,
        isExample: true,
        comments: [],
      },
    ],
  };
}

function loadState(): TrackerState {
  return createSeedState();
}

export default function JobTrackerRail() {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const [state, setState] = useState<TrackerState>(loadState);
  const [newCompany, setNewCompany] = useState('');
  const [newRole, setNewRole] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [commentForId, setCommentForId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [armedDeleteGroupId, setArmedDeleteGroupId] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const [dragState, setDragState] = useState<{
    type: 'job' | 'group';
    id: string;
    pointerId: number;
  } | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const focusGroupInputIdRef = useRef<string | null>(null);
  const focusGripRef = useRef<{ type: 'job' | 'group'; id: string } | null>(null);
  const armedTimerRef = useRef<number | null>(null);

  const lastRemoteSerializedRef = useRef<string>('');
  const lastPersistedSerializedRef = useRef<string>('');
  const remoteIdsRef = useRef<RemoteTrackerIds>({
    groupIds: new Set<string>(),
    jobIds: new Set<string>(),
    commentIds: new Map<string, Set<string>>(),
  });

  // Seed the rail for brand-new workspaces with an empty Firestore
  const seededRef = useRef(false);

  // Real-time Firestore subscription with echo suppression
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    trackerCollectionsAreEmpty(uid)
      .then((empty) => {
        if (!cancelled && empty && !seededRef.current) {
          seededRef.current = true;
          const seed = createSeedState();
          syncTrackerState(uid, seed, {
            groupIds: new Set<string>(),
            jobIds: new Set<string>(),
            commentIds: new Map<string, Set<string>>(),
          }).catch((err) => console.warn('Tracker seed failed:', err));
        }
      })
      .catch(() => {});
    const unsub = subscribeTracker(
      uid,
      (incoming) => {
        if (cancelled) return;
        const serialized = JSON.stringify({
          groups: incoming.groups,
          jobs: incoming.jobs.map((j) => ({ ...j, comments: [...j.comments].sort((a, b) => a.id.localeCompare(b.id)) })),
        });
        if (serialized === lastPersistedSerializedRef.current) {
          remoteIdsRef.current = captureRemoteTrackerIds(incoming);
          return;
        }
        lastRemoteSerializedRef.current = serialized;
        remoteIdsRef.current = captureRemoteTrackerIds(incoming);
        setState(incoming);
      },
      (err) => console.warn('Tracker subscription failed:', err)
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [uid]);

  // Persist local edits to Firestore (full reconcile of jobs/groups/comments)
  useEffect(() => {
    if (!uid) return;
    const serialized = JSON.stringify({
      groups: state.groups,
      jobs: state.jobs.map((j) => ({ ...j, comments: [...j.comments].sort((a, b) => a.id.localeCompare(b.id)) })),
    });
    if (serialized === lastRemoteSerializedRef.current) return;
    lastPersistedSerializedRef.current = serialized;
    syncTrackerState(uid, state, remoteIdsRef.current)
      .then((nextIds) => {
        remoteIdsRef.current = nextIds;
      })
      .catch((err) => console.warn('Tracker sync failed:', err));
  }, [state, uid]);

  useEffect(() => {
    if (focusGroupInputIdRef.current) {
      const targetId = focusGroupInputIdRef.current;
      focusGroupInputIdRef.current = null;
      const input = listRef.current?.querySelector<HTMLInputElement>(
        `[data-gname="${targetId}"]`
      );
      if (input) {
        input.focus();
        input.select();
      }
    }
  }, [state.groups.length]);

  useEffect(() => {
    if (focusGripRef.current) {
      const target = focusGripRef.current;
      focusGripRef.current = null;
      const selector =
        target.type === 'job'
          ? `[data-grip="${target.id}"]`
          : `[data-ggrip="${target.id}"]`;
      const el = listRef.current?.querySelector<HTMLButtonElement>(selector);
      el?.focus();
    }
  }, [state]);

  const groupIds = useMemo(
    () => new Set(state.groups.map((g) => g.id)),
    [state.groups]
  );

  const ungroupedJobs = useMemo(
    () => state.jobs.filter((j) => !j.group || !groupIds.has(j.group)),
    [state.jobs, groupIds]
  );

  const handleAddJob = (e: React.FormEvent) => {
    e.preventDefault();
    const company = newCompany.trim();
    const role = newRole.trim();
    if (!company) return;
    const job: TrackerJob = {
      id: makeUid(),
      company,
      role,
      stage: 'Saved',
      pay: 0,
      loc: '',
      group: state.groups.length ? state.groups[0].id : '',
      comments: [],
    };
    setState((prev) => ({ ...prev, jobs: [...prev.jobs, job] }));
    setNewCompany('');
    setNewRole('');
  };

  const handleNewGroup = () => {
    const used = new Set(state.groups.map((g) => g.color));
    const color =
      PALETTE.find((c) => !used.has(c)) ||
      PALETTE[state.groups.length % PALETTE.length];
    const newGroup: TrackerGroup = {
      id: makeUid(),
      name: `Group ${state.groups.length + 1}`,
      color,
      collapsed: false,
    };
    focusGroupInputIdRef.current = newGroup.id;
    setState((prev) => ({ ...prev, groups: [newGroup, ...prev.groups] }));
  };

  const handleRenameGroup = (groupId: string, name: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === groupId ? { ...g, name } : g)),
    }));
  };

  const handleCycleGroupColor = (groupId: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => {
        if (g.id !== groupId) return g;
        const idx = PALETTE.indexOf(g.color);
        return { ...g, color: PALETTE[(idx + 1) % PALETTE.length] };
      }),
    }));
  };

  const handleToggleGroup = (groupId: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
      ),
    }));
  };

  const handleDeleteGroupClick = (groupId: string) => {
    if (armedDeleteGroupId === groupId) {
      if (armedTimerRef.current) {
        window.clearTimeout(armedTimerRef.current);
        armedTimerRef.current = null;
      }
      setArmedDeleteGroupId(null);
      setState((prev) => ({
        groups: prev.groups.filter((g) => g.id !== groupId),
        jobs: prev.jobs.map((j) =>
          j.group === groupId ? { ...j, group: '' } : j
        ),
      }));
    } else {
      setArmedDeleteGroupId(groupId);
      if (armedTimerRef.current) window.clearTimeout(armedTimerRef.current);
      armedTimerRef.current = window.setTimeout(() => {
        setArmedDeleteGroupId((cur) => (cur === groupId ? null : cur));
      }, 3000);
    }
  };

  const handleCycleJobStage = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) => {
        if (j.id !== jobId) return j;
        const idx = STAGES.indexOf(j.stage);
        return { ...j, stage: STAGES[(idx + 1) % STAGES.length] };
      }),
    }));
  };

  const handleSubmitComment = (jobId: string, e: React.FormEvent) => {
    e.preventDefault();
    const text = commentDraft.trim();
    if (!text) return;
    const comment: TrackerComment = { id: makeUid(), text, at: nowHm() };
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) =>
        j.id === jobId ? { ...j, comments: [...(j.comments || []), comment] } : j
      ),
    }));
    setCommentDraft('');
    setCommentForId(null);
  };

  const handleDeleteComment = (jobId: string, commentId: string) => {
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) =>
        j.id === jobId
          ? { ...j, comments: (j.comments || []).filter((c) => c.id !== commentId) }
          : j
      ),
    }));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState) return;
    const target = e.target as HTMLElement;
    const jobGrip = target.closest('[data-grip]') as HTMLElement | null;
    const groupGrip = target.closest('[data-ggrip]') as HTMLElement | null;
    if (!jobGrip && !groupGrip) return;

    e.preventDefault();
    const id = jobGrip
      ? jobGrip.getAttribute('data-grip')
      : groupGrip?.getAttribute('data-ggrip');
    if (!id) return;

    try {
      listRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Ignore pointer capture errors
    }

    setDragState({
      type: jobGrip ? 'job' : 'group',
      id,
      pointerId: e.pointerId,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || e.pointerId !== dragState.pointerId || !listRef.current) return;
    const listEl = listRef.current;
    const y = e.clientY;
    const rect = listEl.getBoundingClientRect();
    if (y < rect.top + 36) listEl.scrollTop -= 12;
    else if (y > rect.bottom - 36) listEl.scrollTop += 12;

    if (dragState.type === 'job') {
      const sections = Array.from(
        listEl.querySelectorAll('.tracker-grp[data-gid]')
      ) as HTMLElement[];
      if (!sections.length) return;

      let targetSection: HTMLElement | null = null;
      for (const sec of sections) {
        const b = sec.getBoundingClientRect();
        if (y >= b.top && y <= b.bottom) {
          targetSection = sec;
          break;
        }
      }
      if (!targetSection) {
        targetSection =
          y < sections[0].getBoundingClientRect().top
            ? sections[0]
            : sections[sections.length - 1];
      }

      const targetGid = targetSection.getAttribute('data-gid') ?? '';
      const rowEls = (
        Array.from(
          targetSection.querySelectorAll('.tracker-row[data-id]')
        ) as HTMLElement[]
      ).filter((el) => el.getAttribute('data-id') !== dragState.id);

      let insertBeforeId: string | null = null;
      for (const rowEl of rowEls) {
        const rb = rowEl.getBoundingClientRect();
        if (y < rb.top + rb.height / 2) {
          insertBeforeId = rowEl.getAttribute('data-id');
          break;
        }
      }

      setState((prev) => {
        const movingJob = prev.jobs.find((j) => j.id === dragState.id);
        if (!movingJob) return prev;
        const remaining = prev.jobs.filter((j) => j.id !== dragState.id);
        const updatedJob: TrackerJob = { ...movingJob, group: targetGid };

        let targetIdx = -1;
        if (insertBeforeId) {
          targetIdx = remaining.findIndex((j) => j.id === insertBeforeId);
        } else {
          const validIds = new Set(prev.groups.map((g) => g.id));
          let lastInGroupIdx = -1;
          remaining.forEach((j, idx) => {
            const normalizedGroup = j.group && validIds.has(j.group) ? j.group : '';
            if (normalizedGroup === targetGid) lastInGroupIdx = idx;
          });
          targetIdx = lastInGroupIdx >= 0 ? lastInGroupIdx + 1 : remaining.length;
        }
        if (targetIdx < 0) targetIdx = remaining.length;

        const nextJobs = [
          ...remaining.slice(0, targetIdx),
          updatedJob,
          ...remaining.slice(targetIdx),
        ];

        const unchanged =
          nextJobs.length === prev.jobs.length &&
          nextJobs.every(
            (j, i) => j.id === prev.jobs[i].id && j.group === prev.jobs[i].group
          );
        return unchanged ? prev : { ...prev, jobs: nextJobs };
      });
    } else {
      const groupEls = (
        Array.from(
          listEl.querySelectorAll('.tracker-grp[data-gid]')
        ) as HTMLElement[]
      ).filter((el) => {
        const gid = el.getAttribute('data-gid');
        return !!gid && gid !== dragState.id;
      });

      let beforeGroupId: string | null = null;
      for (const gEl of groupEls) {
        const gb = gEl.getBoundingClientRect();
        if (y < gb.top + gb.height / 2) {
          beforeGroupId = gEl.getAttribute('data-gid');
          break;
        }
      }

      setState((prev) => {
        const moving = prev.groups.find((g) => g.id === dragState.id);
        if (!moving) return prev;
        const rest = prev.groups.filter((g) => g.id !== dragState.id);
        const idx = beforeGroupId
          ? rest.findIndex((g) => g.id === beforeGroupId)
          : rest.length;
        const insertAt = idx >= 0 ? idx : rest.length;
        const nextGroups = [
          ...rest.slice(0, insertAt),
          moving,
          ...rest.slice(insertAt),
        ];
        const unchanged = nextGroups.every((g, i) => g.id === prev.groups[i].id);
        return unchanged ? prev : { ...prev, groups: nextGroups };
      });
    }
  };

  const endPointerDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    try {
      listRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore release errors
    }
    setDragState(null);
  };

  const handleGripKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const jobId = e.currentTarget.getAttribute('data-grip');
    const groupId = e.currentTarget.getAttribute('data-ggrip');
    if (!jobId && !groupId) return;
    e.preventDefault();

    if (jobId) {
      setState((prev) => {
        const validIds = new Set(prev.groups.map((g) => g.id));
        const visualOrder: TrackerJob[] = [
          ...prev.groups.flatMap((g) => prev.jobs.filter((j) => j.group === g.id)),
          ...prev.jobs.filter((j) => !j.group || !validIds.has(j.group)),
        ];
        const i = visualOrder.findIndex((j) => j.id === jobId);
        const targetPos = i + (e.key === 'ArrowUp' ? -1 : 1);
        if (i < 0 || targetPos < 0 || targetPos >= visualOrder.length) return prev;

        const targetNeighbor = visualOrder[targetPos];
        const moving = visualOrder[i];
        const nextGroup =
          targetNeighbor.group && validIds.has(targetNeighbor.group)
            ? targetNeighbor.group
            : '';

        const updatedVisual = [...visualOrder];
        updatedVisual[i] = targetNeighbor;
        updatedVisual[targetPos] = { ...moving, group: nextGroup };

        focusGripRef.current = { type: 'job', id: jobId };
        return { ...prev, jobs: updatedVisual };
      });
    } else if (groupId) {
      setState((prev) => {
        const i = prev.groups.findIndex((g) => g.id === groupId);
        const j = i + (e.key === 'ArrowUp' ? -1 : 1);
        if (i < 0 || j < 0 || j >= prev.groups.length) return prev;
        const nextGroups = [...prev.groups];
        const tmp = nextGroups[i];
        nextGroups[i] = nextGroups[j];
        nextGroups[j] = tmp;
        focusGripRef.current = { type: 'group', id: groupId };
        return { ...prev, groups: nextGroups };
      });
    }
  };

  const renderJobRow = (job: TrackerJob) => {
    const comments = job.comments || [];
    const isSelected = selectedJobId === job.id;
    const isExpanded = !!expandedComments[job.id];
    const isAddingComment = commentForId === job.id;
    const isDragging = dragState?.type === 'job' && dragState.id === job.id;
    const dotClass = STAGE_DOT_CLASS[job.stage] || 'dot-saved';

    return (
      <li
        key={job.id}
        data-id={job.id}
        className={`tracker-row ${isSelected ? 'sel' : ''} ${isDragging ? 'dragging' : ''}`}
      >
        <button
          type="button"
          className="tracker-grip"
          data-grip={job.id}
          onKeyDown={handleGripKeyDown}
          aria-label={`Reorder ${job.company}`}
          title="Drag or use Up/Down arrow keys to reorder"
        />
        <div
          role="button"
          tabIndex={0}
          className="tracker-chip"
          onClick={() => setSelectedJobId(job.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedJobId(job.id);
            }
          }}
        >
          <div className="tracker-c1">
            <button
              type="button"
              onClick={(e) => handleCycleJobStage(job.id, e)}
              className="tracker-stage-btn"
              title={`Stage: ${job.stage} (click to cycle)`}
              aria-label={`Stage ${job.stage}, click to change`}
            >
              <i className={`tracker-dot ${dotClass}`} />
            </button>
            <span className="tracker-co">{job.company || 'New job'}</span>
            {job.isExample && <span className="tracker-example-pill">Example</span>}
            <span className="tracker-pay">{formatPay(job.pay)}</span>
          </div>
          <div className="tracker-c2">
            <span className="tracker-stage-text">{job.stage}</span>
            <span> · {job.role || 'No role yet'}</span>
            {job.loc ? <span> · {job.loc}</span> : null}
          </div>
        </div>

        <div className="tracker-rowcm">
          {comments.length > 0 &&
            (isExpanded ? (
              <div className="tracker-thread">
                {comments
                  .slice()
                  .reverse()
                  .map((c) => (
                    <div key={c.id} className="tracker-cm">
                      <span>
                        {c.text}
                        <small>{c.at}</small>
                      </span>
                      <button
                        type="button"
                        className="tracker-cmx"
                        onClick={() => handleDeleteComment(job.id, c.id)}
                        aria-label="Delete comment"
                        title="Delete comment"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                <button
                  type="button"
                  className="tracker-cm-prev"
                  onClick={() =>
                    setExpandedComments((prev) => ({ ...prev, [job.id]: false }))
                  }
                  aria-expanded="true"
                >
                  <span>Hide comments</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="tracker-cm-prev"
                onClick={() =>
                  setExpandedComments((prev) => ({ ...prev, [job.id]: true }))
                }
                aria-expanded="false"
              >
                <span>{comments[comments.length - 1].text}</span>
                <b>
                  {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                </b>
              </button>
            ))}

          {isAddingComment ? (
            <form
              className="tracker-cmform"
              onSubmit={(e) => handleSubmitComment(job.id, e)}
              autoComplete="off"
            >
              <input
                type="text"
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Add a comment"
                aria-label={`Comment on ${job.company}`}
                autoFocus
              />
              <button type="submit" className="tracker-btn-ghost">
                Post
              </button>
              <button
                type="button"
                className="tracker-btn-ghost"
                onClick={() => {
                  setCommentForId(null);
                  setCommentDraft('');
                }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="tracker-cm-add"
              onClick={() => {
                setCommentForId(job.id);
                setCommentDraft('');
              }}
            >
              + Add comment
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <aside
      className={`tracker-rail-column ${mobileExpanded ? 'mobile-expanded' : ''}`}
      aria-label="Job tracker"
    >
      <div className="tracker-mobile-bar">
        <button
          type="button"
          className="tracker-mobile-toggle"
          onClick={() => setMobileExpanded((v) => !v)}
          aria-expanded={mobileExpanded}
        >
          {mobileExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <span>Job Tracker</span>
          <span className="tracker-mobile-count">{state.jobs.length}</span>
        </button>
      </div>

      <div className="tracker-rail-inner">
        <div className="tracker-rail-head">
          <div>
            <span className="tiny-label">JOB TRACKER</span>
            <h2>Applications rail</h2>
          </div>
          <button
            type="button"
            className="tracker-btn-ghost"
            onClick={handleNewGroup}
          >
            <Plus size={13} />
            New group
          </button>
        </div>

        <form onSubmit={handleAddJob} className="tracker-addbox" autoComplete="off">
          <input
            type="text"
            maxLength={60}
            value={newCompany}
            onChange={(e) => setNewCompany(e.target.value)}
            placeholder="Company"
            aria-label="Company"
          />
          <div className="tracker-addrow">
            <input
              type="text"
              maxLength={80}
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="Role title"
              aria-label="Role title"
            />
            <button type="submit" className="tracker-btn-primary">
              Add
            </button>
          </div>
        </form>

        <p className="tracker-note">
          Drag grips to reorder jobs and groups, or focus a grip and press ↑ / ↓.
        </p>

        <div
          ref={listRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointerDrag}
          onPointerCancel={endPointerDrag}
          className={`tracker-list ${dragState ? 'dragmode' : ''} ${
            dragState?.type === 'group' ? 'groupdrag' : ''
          }`}
        >
          {state.groups.map((g) => {
            const items = state.jobs.filter((j) => j.group === g.id);
            const isDraggingGroup =
              dragState?.type === 'group' && dragState.id === g.id;
            return (
              <section
                key={g.id}
                data-gid={g.id}
                style={{ ['--gc' as string]: g.color }}
                className={`tracker-grp colored ${g.collapsed ? 'collapsed' : ''} ${
                  isDraggingGroup ? 'dragging' : ''
                }`}
              >
                <div className="tracker-gh">
                  <button
                    type="button"
                    className="tracker-grip ggrip"
                    data-ggrip={g.id}
                    onKeyDown={handleGripKeyDown}
                    aria-label={`Reorder group ${g.name}`}
                    title="Drag or use Up/Down arrow keys to reorder group"
                  />
                  <button
                    type="button"
                    className="tracker-gtog"
                    onClick={() => handleToggleGroup(g.id)}
                    aria-expanded={!g.collapsed}
                    aria-label={`Toggle ${g.name}`}
                  />
                  <button
                    type="button"
                    className="tracker-gsw"
                    onClick={() => handleCycleGroupColor(g.id)}
                    aria-label="Change group color"
                    title="Click to cycle color"
                  />
                  <input
                    className="tracker-gname"
                    data-gname={g.id}
                    value={g.name}
                    onChange={(e) => handleRenameGroup(g.id, e.target.value)}
                    aria-label="Group name"
                  />
                  <span className="tracker-gcount">{items.length}</span>
                  <button
                    type="button"
                    className={`tracker-gdel ${
                      armedDeleteGroupId === g.id ? 'armed' : ''
                    }`}
                    onClick={() => handleDeleteGroupClick(g.id)}
                    aria-label={
                      armedDeleteGroupId === g.id
                        ? `Confirm delete ${g.name}`
                        : `Delete ${g.name}`
                    }
                  >
                    {armedDeleteGroupId === g.id ? 'Sure?' : '×'}
                  </button>
                </div>
                <ul className="tracker-items">{items.map(renderJobRow)}</ul>
              </section>
            );
          })}

          {state.groups.length > 0 ? (
            <section className="tracker-grp plain" data-gid="">
              <div className="tracker-gh">
                <span className="tracker-gstatic">Ungrouped</span>
                <span className="tracker-gcount">{ungroupedJobs.length}</span>
              </div>
              <ul className="tracker-items">{ungroupedJobs.map(renderJobRow)}</ul>
            </section>
          ) : state.jobs.length > 0 ? (
            <section className="tracker-grp plain" data-gid="">
              <ul className="tracker-items">{state.jobs.map(renderJobRow)}</ul>
            </section>
          ) : (
            <p className="tracker-emptyl">
              No applications yet. Add a company and role above.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
