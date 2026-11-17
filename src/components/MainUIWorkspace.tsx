import React, { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { getUserStoreValue, setUserStoreValue, useUserStoreReady } from '../utils/userStore';
import { authFetch } from '../firebase/client';
import type { JobFixture } from '../types';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  CircleHelp,
  Compass,
  Cpu,
  Download,
  ExternalLink,
  FileText,
  FolderKanban,
  GraduationCap,
  Heart,
  Layers3,
  LayoutDashboard,
  Lightbulb,
  Menu,
  Moon,
  PanelRight,
  PanelRightClose,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import JobTrackerRail from './JobTrackerRail';

type AnyRecord = Record<string, any>;
type Data = {
  profile: AnyRecord;
  skills: AnyRecord[];
  opportunities: AnyRecord[];
  applications: AnyRecord[];
  resumes: AnyRecord[];
  projects: AnyRecord[];
  learning: AnyRecord[];
  services: AnyRecord[];
  theme: 'light' | 'dark';
  sample: boolean;
};

interface MainUIWorkspaceProps {
  onOpenBackendDev: () => void;
  isIntelligenceOpen?: boolean;
  onToggleIntelligence?: () => void;
  onOpenIntelligence?: () => void;
}

const STORE = 'xelime-career-workspace-v2';
const LEGACY_STORE = 'xelime-career-workspace-v1';

const starter: Data = {
  profile: {
    displayName: '',
    headline: '',
    location: '',
    summary: '',
    experience: [],
    education: [],
  },
  skills: [],
  opportunities: [],
  applications: [],
  resumes: [],
  projects: [],
  learning: [],
  services: [],
  theme: 'light',
  sample: false,
};

const nav = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Identity', href: '/profile', icon: UserRound },
  { label: 'Skills', href: '/skills', icon: Layers3 },
  { label: 'Opportunities', href: '/opportunities', icon: Target },
  { label: 'Job Feed', href: '/job-feed', icon: Compass },
  { label: 'Applications', href: '/applications', icon: BriefcaseBusiness },
  { label: 'Resume', href: '/resume', icon: FileText },
  { label: 'Portfolio', href: '/portfolio', icon: FolderKanban },
  { label: 'Development', href: '/development', icon: GraduationCap },
  { label: 'Services', href: '/services', icon: Wrench },
  { label: 'XELIME Intelligence', href: '/assistant', icon: Sparkles },
  { label: 'Analytics', href: '/analytics', icon: Activity },
];

const configs: Record<
  string,
  { key: keyof Data; title: string; singular: string; fields: string[]; helper?: string }
> = {
  skills: {
    key: 'skills',
    title: 'Skills & evidence',
    singular: 'skill',
    fields: ['name', 'category', 'proficiency', 'years', 'lastUsed', 'evidence'],
  },
  opportunities: {
    key: 'opportunities',
    title: 'Opportunities',
    singular: 'opportunity',
    fields: [
      'title',
      'company',
      'industry',
      'salary',
      'employmentType',
      'workplace',
      'compatibility',
      'missingSkills',
      'category',
    ],
  },
  applications: {
    key: 'applications',
    title: 'Applications',
    singular: 'application',
    fields: ['role', 'company', 'status', 'appliedDate', 'nextStep', 'notes'],
  },
  resumes: {
    key: 'resumes',
    title: 'Resume versions',
    singular: 'resume version',
    fields: ['name', 'targetRole', 'updatedAt', 'sourceSkills'],
  },
  projects: {
    key: 'projects',
    title: 'Portfolio evidence',
    singular: 'project',
    fields: ['title', 'industry', 'software', 'skills', 'description', 'outcomes', 'completedAt'],
  },
  learning: {
    key: 'learning',
    title: 'Learning plans',
    singular: 'learning item',
    fields: ['title', 'provider', 'skill', 'progress', 'targetDate', 'status'],
  },
  services: {
    key: 'services',
    title: 'Services',
    singular: 'service',
    fields: ['title', 'description', 'skills', 'pricing', 'deliveryTime', 'availability'],
  },
};

const labelize = (s: string) => s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
const makeId = () => Math.random().toString(36).slice(2, 10);

const readData = (): Data => {
  try {
    const raw = getUserStoreValue(STORE);
    if (raw) return { ...starter, ...JSON.parse(raw) };
    return starter;
  } catch {
    return starter;
  }
};

type ViewContext = {
  data: Data;
  path: string;
  navigate: (href: string) => void;
  query: string;
  setQuery: (s: string) => void;
  filter: string;
  setFilter: (s: string) => void;
  openDialog: (d: { kind: string; record?: AnyRecord } | null) => void;
  upsert: (k: keyof Data, r: AnyRecord) => void;
  remove: (k: keyof Data, id: string) => void;
  update: (k: keyof Data, v: any) => void;
  notify: (s: string) => void;
  exportData: () => void;
  resetData: () => void;
  requestConfirm: (prompt: { title: string; body: string; onConfirm: () => void }) => void;
};

export default function MainUIWorkspace({
  onOpenBackendDev,
  isIntelligenceOpen = false,
  onToggleIntelligence,
  onOpenIntelligence,
}: MainUIWorkspaceProps) {
  const [data, setData] = useState<Data>(readData);
  const [path, setPath] = useState<string>('/');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dialog, setDialog] = useState<{ kind: string; record?: AnyRecord } | null>(null);
  const [confirmPrompt, setConfirmPrompt] = useState<{
    title: string;
    body: string;
    onConfirm: () => void;
  } | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [toast, setToast] = useState('');
  const [showGridForge, setShowGridForge] = useState(true);
  const [gridForgeKey, setGridForgeKey] = useState(0);
  const [dockWidth, setDockWidth] = useState(480);
  const [isResizingDock, setIsResizingDock] = useState(false);
  const gridForgeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [savedJobs, setSavedJobs] = useState<AnyRecord[]>([]);

  const postToGridForge = React.useCallback(
    (jobsOverride?: AnyRecord[]) => {
      const targetWindow = gridForgeRef.current?.contentWindow;
      if (!targetWindow) return;
      targetWindow.postMessage(
        {
          type: 'gridforge:sync',
          profile: data.profile,
          skills: data.skills,
          savedJobs: jobsOverride ?? savedJobs,
        },
        window.location.origin
      );
    },
    [data.profile, data.skills, savedJobs]
  );

  const storeReady = useUserStoreReady();

  useEffect(() => {
    if (!storeReady) return;
    const raw = getUserStoreValue(STORE);
    if (raw) {
      try {
        setData({ ...starter, ...JSON.parse(raw) });
      } catch {
        // Ignore corrupt payload
      }
    }
    const savedRaw = getUserStoreValue('xelime-saved-jobs-v1');
    if (savedRaw) {
      try {
        const parsed = JSON.parse(savedRaw);
        if (Array.isArray(parsed)) setSavedJobs(parsed);
      } catch {
        // Ignore corrupt payload
      }
    }
  }, [storeReady]);

  useEffect(() => {
    if (!storeReady) return;
    setUserStoreValue(STORE, JSON.stringify(data));
  }, [data, storeReady]);

  useEffect(() => {
    if (!storeReady) return;
    setUserStoreValue('xelime-saved-jobs-v1', JSON.stringify(savedJobs));
  }, [savedJobs, storeReady]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !event.data) return;
      if (event.data.type === 'xelime:saved-jobs' && Array.isArray(event.data.jobs)) {
        setSavedJobs(event.data.jobs);
        postToGridForge(event.data.jobs);
      }
      if (event.data.type === 'xelime:feed-state' && event.data.state) {
        setUserStoreValue('xelime-job-feed-state-v1', JSON.stringify(event.data.state));
      }
      if (event.data.type === 'gridforge:request-sync') {
        postToGridForge();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [postToGridForge]);

  useEffect(() => {
    if (showGridForge) {
      postToGridForge();
    }
  }, [showGridForge, postToGridForge]);

  useEffect(() => {
    if (!isResizingDock) return;
    const handleMouseMove = (event: MouseEvent) => {
      const nextWidth = Math.min(760, Math.max(340, window.innerWidth - event.clientX));
      setDockWidth(nextWidth);
    };
    const handleMouseUp = () => setIsResizingDock(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingDock]);

  const navigate = (href: string) => {
    setPath(href);
    setMobileOpen(false);
    setQuery('');
    setFilter('All');
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const update = (key: keyof Data, value: any) => setData((d) => ({ ...d, [key]: value }));

  const upsert = (key: keyof Data, record: AnyRecord) => {
    const rows = (data[key] as AnyRecord[]) || [];
    update(
      key,
      record.id
        ? rows.map((r) => (r.id === record.id ? record : r))
        : [{ ...record, id: makeId() }, ...rows]
    );
    setDialog(null);
    notify(record.id ? 'Changes saved' : 'Added to your workspace');
  };

  const remove = (key: keyof Data, recordId: string) => {
    setConfirmPrompt({
      title: 'Remove record',
      body: 'Remove this record from your local workspace?',
      onConfirm: () => {
        setData((d) => ({
          ...d,
          [key]: ((d[key] as AnyRecord[]) || []).filter((r) => r.id !== recordId),
        }));
        notify('Record removed');
        setConfirmPrompt(null);
      },
    });
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'xelime-career-data.json';
    a.click();
    URL.revokeObjectURL(url);
    notify('Local data exported');
  };

  const resetData = () => {
    setConfirmPrompt({
      title: 'Clear workspace',
      body: 'Clear all records in this workspace? Any persisted sample or edited records will be removed.',
      onConfirm: () => {
        setData({
          ...starter,
          profile: { ...starter.profile },
          skills: [...starter.skills],
          opportunities: [...starter.opportunities],
          applications: [...starter.applications],
          resumes: [...starter.resumes],
          projects: [...starter.projects],
          learning: [...starter.learning],
          services: [...starter.services],
        });
        notify('Workspace cleared');
        setConfirmPrompt(null);
      },
    });
  };

  const title =
    nav.find((n) => n.href === path)?.label ||
    (path === '/settings' ? 'Settings' : 'Career workspace');

  const context: ViewContext = {
    data,
    path,
    navigate,
    query,
    setQuery,
    filter,
    setFilter,
    openDialog: setDialog,
    upsert,
    remove,
    update,
    notify,
    exportData,
    resetData,
    requestConfirm: setConfirmPrompt,
  };

  const renderPage = () => {
    switch (path) {
      case '/':
        return <Overview {...context} />;
      case '/profile':
        return <Profile {...context} />;
      case '/skills':
        return <Collection {...context} kind="skills" />;
      case '/opportunities':
        return <Opportunities {...context} />;
      case '/job-feed':
        return <JobFeedPrototypePanel theme={data.theme} />;
      case '/applications':
        return <Collection {...context} kind="applications" />;
      case '/resume':
        return <Collection {...context} kind="resumes" />;
      case '/portfolio':
        return <Collection {...context} kind="projects" />;
      case '/development':
        return <Collection {...context} kind="learning" />;
      case '/services':
        return <Collection {...context} kind="services" />;
      case '/assistant':
        return (
          <Assistant
            isIntelligenceOpen={isIntelligenceOpen}
            onToggleIntelligence={onToggleIntelligence}
            onOpenIntelligence={onOpenIntelligence}
          />
        );
      case '/analytics':
        return <Analytics {...context} />;
      case '/settings':
        return <SettingsPage {...context} />;
      default:
        return <NotFound navigate={navigate} />;
    }
  };

  return (
    <div className={`xelime-main-ui ${data.theme === 'dark' ? 'dark' : ''}`}>
      <div className="app-shell">
        <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
          <div className="brand">
            <div className="brand-mark">X</div>
            <div>
              <strong>XELIME</strong>
              <span>CAREER ENGINE</span>
            </div>
            <button
              type="button"
              className="icon-button mobile-close"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="workspace-label">YOUR WORKSPACE</div>
          <nav className="side-nav" aria-label="Primary navigation">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className={`nav-link ${path === item.href ? 'active' : ''}`}
                  data-testid={`link-${item.href.slice(1) || 'overview'}`}
                >
                  <Icon size={17} strokeWidth={1.8} />
                  <span>{item.label}</span>
                  {item.href === '/assistant' && (
                    <span
                      className={onToggleIntelligence ? 'online-dot' : 'preview-dot'}
                      style={{ marginLeft: 'auto' }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
          <div className="sidebar-bottom">
            <button
              type="button"
              onClick={onOpenBackendDev}
              className="backend-switch-btn"
              title="Switch back to Career Engine Backend Dev System"
            >
              <Cpu size={15} />
              <span>Backend Dev System</span>
            </button>
            <div className="local-note">
              <ShieldCheck size={15} />
              <span>Your records stay in this browser</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className={`nav-link ${path === '/settings' ? 'active' : ''}`}
              data-testid="link-settings"
            >
              <Settings size={17} />
              <span>Settings</span>
            </button>
            <div className="profile-chip">
              <div className="avatar">
                {(data.profile.displayName || 'Y')
                  .split(' ')
                  .map((p: string) => p[0])
                  .join('')
                  .slice(0, 2)}
              </div>
              <div className="profile-chip-copy">
                <strong>{data.profile.displayName || 'Your workspace'}</strong>
                <span>Personal account</span>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Toggle theme"
                onClick={() =>
                  setData((d) => ({ ...d, theme: d.theme === 'dark' ? 'light' : 'dark' }))
                }
              >
                {data.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </div>
        </aside>
        {mobileOpen && (
          <button
            type="button"
            className="scrim"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <main className="main-area">
          <header className="topbar">
            <button
              type="button"
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="crumb">
              Workspace <span>/</span> <b>{title}</b>
            </div>
            <div className="top-actions">
              <span className="saved-indicator">
                <span /> Saved locally
              </span>
              {onToggleIntelligence && (
                <button
                  type="button"
                  onClick={onToggleIntelligence}
                  aria-expanded={isIntelligenceOpen}
                  className={`button ${isIntelligenceOpen ? 'button-primary' : 'button-secondary'}`}
                  style={{ minHeight: '30px', fontSize: '10px', padding: '0 10px' }}
                  title={
                    isIntelligenceOpen
                      ? 'Hide XELIME Intelligence window'
                      : 'Open XELIME Intelligence window'
                  }
                >
                  <Sparkles size={13} />
                  Intelligence
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowGridForge((open) => !open)}
                className={`button ${showGridForge ? 'button-primary' : 'button-secondary'}`}
                style={{ minHeight: '30px', fontSize: '10px', padding: '0 10px' }}
                title={showGridForge ? 'Hide GridForge panel' : 'Show GridForge panel'}
              >
                {showGridForge ? <PanelRightClose size={13} /> : <PanelRight size={13} />}
                GridForge
              </button>
              <button
                type="button"
                onClick={onOpenBackendDev}
                className="button button-secondary"
                style={{ minHeight: '30px', fontSize: '10px', padding: '0 10px' }}
              >
                <Cpu size={13} />
                Backend Dev
              </button>
              <button
                type="button"
                className="top-icon"
                aria-label="Toggle theme"
                onClick={() =>
                  setData((d) => ({ ...d, theme: d.theme === 'dark' ? 'light' : 'dark' }))
                }
              >
                {data.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="top-icon"
                aria-label="Settings"
              >
                <Settings size={17} />
              </button>
            </div>
          </header>
          <div className="workspace-split">
            <JobTrackerRail />
            <div className="workspace-primary">
              <div className="page-wrap">
                <div className="page-content">
                  <div className="page-eyebrow">
                    <span className="eyebrow-line" />
                    {title}
                  </div>
                  {data.sample && (
                    <div className="sample-banner">
                      <Lightbulb size={15} />
                      <span>
                        <b>Editable examples from your brief.</b> Confirm or edit every detail
                        before using it as your real career history.
                      </span>
                      <button
                        type="button"
                        onClick={() => setData((d) => ({ ...d, sample: false }))}
                        aria-label="Dismiss sample notice"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}
                  {renderPage()}
                  <footer className="page-footer">
                    <span>XELIME CAREER ENGINE</span>
                    <span>Private by design · Local browser storage</span>
                  </footer>
                </div>
              </div>
            </div>
            {showGridForge && (
              <>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize GridForge panel"
                  className={`dock-resizer ${isResizingDock ? 'dragging' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsResizingDock(true);
                  }}
                />
                <aside
                  className="right-dock"
                  aria-label="GridForge Canvas"
                  style={{ width: `${dockWidth}px` }}
                >
                  <div className="right-dock-header">
                    <div className="right-dock-title">
                      <span className="right-dock-dot" />
                      <strong>GridForge</strong>
                      <span>
                        1 profile · {savedJobs.length} saved
                      </span>
                    </div>
                    <div className="right-dock-actions">
                      <button
                        type="button"
                        className="right-dock-icon"
                        title="Sync profile & saved jobs"
                        aria-label="Sync profile & saved jobs"
                        onClick={() => postToGridForge()}
                      >
                        <RefreshCw size={13} />
                      </button>
                      <a
                        href="/assets/aistudio/Qwen_html_20260930_ldn0ex84l_d25267d0.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="right-dock-icon"
                        title="Open GridForge standalone"
                        aria-label="Open GridForge standalone"
                      >
                        <ExternalLink size={13} />
                      </a>
                      <button
                        type="button"
                        className="right-dock-icon"
                        title="Hide GridForge panel"
                        aria-label="Hide GridForge panel"
                        onClick={() => setShowGridForge(false)}
                      >
                        <PanelRightClose size={14} />
                      </button>
                    </div>
                  </div>
                  <iframe
                    key={gridForgeKey}
                    ref={gridForgeRef}
                    src="/assets/aistudio/Qwen_html_20260930_ldn0ex84l_d25267d0.html"
                    title="GridForge Canvas"
                    className="right-dock-frame"
                    onLoad={() => postToGridForge()}
                    style={isResizingDock ? { pointerEvents: 'none' } : undefined}
                  />
                </aside>
              </>
            )}
          </div>
        </main>
        {dialog && <RecordDialog dialog={dialog} onClose={() => setDialog(null)} onSave={upsert} />}
        {confirmPrompt && (
          <div
            className="modal-backdrop"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setConfirmPrompt(null);
            }}
          >
            <div className="modal" role="dialog" aria-modal="true" style={{ width: 'min(420px, 100%)' }}>
              <div className="modal-head">
                <div>
                  <span className="tiny-label">CONFIRM ACTION</span>
                  <h2>{confirmPrompt.title}</h2>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setConfirmPrompt(null)}
                  aria-label="Close confirmation"
                >
                  <X size={18} />
                </button>
              </div>
              <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', lineHeight: 1.6 }}>
                {confirmPrompt.body}
              </p>
              <div className="modal-foot">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setConfirmPrompt(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button button-danger"
                  onClick={confirmPrompt.onConfirm}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
        {toast && (
          <div className="toast-message" role="status">
            <Check size={15} />
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function Heading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="heading-row">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function Action({
  children,
  onClick,
  secondary = false,
  icon,
}: {
  children: ReactNode;
  onClick: () => void;
  secondary?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`button ${secondary ? 'button-secondary' : 'button-primary'}`}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
}

function Metric({ label, value, note, icon: Icon, trend }: any) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">
        {trend && (
          <span className="trend">
            <ArrowUpRight size={13} />
            {trend}
          </span>
        )}
        {note}
      </div>
    </div>
  );
}

function Overview(c: ViewContext) {
  const { data, navigate } = c;
  const evidenceCount = data.skills.filter((s) => s.evidence?.trim()).length + data.projects.length;
  return (
    <>
      <Heading
        title={
          data.profile.displayName
            ? `Good to have you, ${data.profile.displayName.split(' ')[0]}.`
            : 'Your career, in focus.'
        }
        description="Your career, organized around what you can prove."
        action={
          <button
            type="button"
            className="button button-primary"
            onClick={() => navigate('/profile')}
          >
            <Pencil size={15} />
            Refine identity
          </button>
        }
      />
      <div className="overview-hero">
        <div className="hero-copy">
          <div className="tiny-label">YOUR PROFESSIONAL NORTH STAR</div>
          <h2>{data.profile.headline || 'Build a clear professional identity.'}</h2>
          <p>
            {data.profile.summary ||
              'Add a concise summary of the work you do and the value you bring.'}
          </p>
          <button type="button" onClick={() => navigate('/profile')} className="text-link">
            View your identity <ArrowRight size={15} />
          </button>
        </div>
        <div className="hero-orbit">
          <div className="orbit-ring ring-one" />
          <div className="orbit-ring ring-two" />
          <div className="orbit-core">
            <span>{String(data.skills.length).padStart(2, '0')}</span>
            <small>skills</small>
          </div>
          <span className="orbit-node node-a" />
          <span className="orbit-node node-b" />
          <span className="orbit-node node-c" />
        </div>
      </div>
      <div className="metrics-grid">
        <Metric
          label="Evidence-backed records"
          value={evidenceCount}
          note="skills & project records"
          icon={ShieldCheck}
        />
        <Metric
          label="Opportunity matches"
          value={data.opportunities.length}
          note="curated examples, not live listings"
          icon={Target}
        />
        <Metric
          label="Active applications"
          value={data.applications.filter((a) => !['Offer', 'Closed'].includes(a.status)).length}
          note="across your pipeline"
          icon={BriefcaseBusiness}
        />
        <Metric
          label="Learning in motion"
          value={`${data.learning.filter((l) => l.status === 'In progress').length}`}
          note="plans underway"
          icon={TrendingUp}
        />
      </div>
      <div className="section-heading">
        <div>
          <div className="tiny-label">NEXT, AT YOUR PACE</div>
          <h2>Keep the signal strong</h2>
        </div>
        <button type="button" onClick={() => navigate('/analytics')} className="text-link">
          Career insights <ArrowRight size={15} />
        </button>
      </div>
      <div className="overview-grid">
        <div className="panel opportunity-spotlight">
          <div className="panel-head">
            <div>
              <span className="tiny-label">OPPORTUNITY RADAR</span>
              <h3>Worth a closer look</h3>
            </div>
            <Target size={18} />
          </div>
          {data.opportunities.slice(0, 2).map((o) => (
            <div className="radar-row" key={o.id}>
              <div className="match-score">
                {o.compatibility}
                <small>%</small>
              </div>
              <div className="radar-copy">
                <strong>{o.title}</strong>
                <span>
                  {o.company} · {o.employmentType}
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/opportunities')}
                aria-label={`View ${o.title}`}
                className="round-arrow"
              >
                <ArrowRight size={15} />
              </button>
            </div>
          ))}
          <div className="micro-note">Illustrative examples based on the brief; no listings are live.</div>
        </div>
        <div className="panel progress-panel">
          <div className="panel-head">
            <div>
              <span className="tiny-label">PROOF, NOT PROMISE</span>
              <h3>Your evidence map</h3>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="evidence-score">
            <div className="score-number">
              {Math.min(
                100,
                Math.round(
                  (evidenceCount / Math.max(data.skills.length + data.projects.length, 1)) * 100
                )
              )}
              <span>%</span>
            </div>
            <div>
              <strong>Evidence attached</strong>
              <span>of your skill & project records</span>
            </div>
          </div>
          <div className="progress-track">
            <span
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    (evidenceCount / Math.max(data.skills.length + data.projects.length, 1)) * 100
                  )
                )}%`,
              }}
            />
          </div>
          <button type="button" onClick={() => navigate('/skills')} className="text-link">
            Strengthen your evidence <ArrowRight size={15} />
          </button>
        </div>
      </div>
      <div className="section-heading">
        <div>
          <div className="tiny-label">QUICK ACCESS</div>
          <h2>Shape what comes next</h2>
        </div>
      </div>
      <div className="quick-links">
        {[
          ['/skills', 'Add evidence', 'Connect a skill to real work', ShieldCheck],
          ['/development', 'Build a skill', 'Move one learning plan forward', BookOpen],
          ['/portfolio', 'Capture a project', 'Keep useful work in one place', FolderKanban],
          ['/assistant', 'XELIME Intelligence', 'Open the AI career console', Sparkles],
        ].map(([href, title, desc, Icon]: any) => (
          <button
            type="button"
            onClick={() => navigate(href)}
            key={href}
            className="quick-card"
          >
            <Icon size={18} />
            <strong>{title}</strong>
            <span>{desc}</span>
            <ArrowRight size={15} className="quick-arrow" />
          </button>
        ))}
      </div>
    </>
  );
}

function Profile(c: ViewContext) {
  const [form, setForm] = useState(c.data.profile);
  useEffect(() => setForm(c.data.profile), [c.data.profile]);
  useEffect(() => {
    const receive = (event: Event) => {
      const { kind, record } = (event as CustomEvent).detail;
      setForm((current: AnyRecord) => ({
        ...current,
        [kind]:
          record._index !== undefined
            ? current[kind].map((item: AnyRecord, index: number) =>
                index === record._index
                  ? Object.fromEntries(Object.entries(record).filter(([key]) => key !== '_index'))
                  : item
              )
            : [...(current[kind] || []), record],
      }));
    };
    window.addEventListener('xelime-nested-record', receive);
    return () => window.removeEventListener('xelime-nested-record', receive);
  }, []);

  const [section, setSection] = useState<'experience' | 'education'>('experience');
  const save = (e: FormEvent) => {
    e.preventDefault();
    c.update('profile', form);
    c.notify('Identity saved locally');
  };
  const editNested = (type: 'experience' | 'education', index?: number) => {
    const item = index === undefined ? {} : { ...form[type][index], _index: index };
    c.openDialog({ kind: type, record: item });
  };

  return (
    <>
      <Heading
        title="Professional identity"
        description="The source of truth for how you describe your work. Keep claims accurate and grounded in evidence."
      />
      <form className="panel identity-form" onSubmit={save}>
        <div className="panel-head">
          <div>
            <span className="tiny-label">YOUR PROFILE</span>
            <h3>A clear introduction</h3>
          </div>
          <span className="local-tag">
            <ShieldCheck size={13} />
            Private
          </span>
        </div>
        <div className="form-grid">
          <Field
            label="Display name"
            value={form.displayName}
            onChange={(v) => setForm({ ...form, displayName: v })}
          />
          <Field
            label="Location"
            value={form.location}
            onChange={(v) => setForm({ ...form, location: v })}
          />
          <Field
            label="Professional headline"
            value={form.headline}
            onChange={(v) => setForm({ ...form, headline: v })}
            wide
          />
          <Field
            label="Summary"
            value={form.summary}
            onChange={(v) => setForm({ ...form, summary: v })}
            multiline
            wide
          />
        </div>
        <div className="form-actions">
          <span>Changes are stored in this browser only.</span>
          <Action
            onClick={() => (document.getElementById('xelime-profile-save') as HTMLButtonElement)?.click()}
            icon={<Check size={15} />}
          >
            Save identity
          </Action>
          <button id="xelime-profile-save" type="submit" hidden />
        </div>
      </form>
      <div className="section-heading">
        <div>
          <div className="tiny-label">CAREER RECORD</div>
          <h2>Experience & education</h2>
        </div>
        <div className="segmented">
          <button
            type="button"
            className={section === 'experience' ? 'selected' : ''}
            onClick={() => setSection('experience')}
          >
            Experience
          </button>
          <button
            type="button"
            className={section === 'education' ? 'selected' : ''}
            onClick={() => setSection('education')}
          >
            Education
          </button>
        </div>
      </div>
      <div className="record-list">
        {(form[section] || []).map((record: AnyRecord, index: number) => (
          <div className="record-card" key={`${section}-${index}`}>
            <div className="record-mark">
              {section === 'experience' ? (
                <BriefcaseBusiness size={17} />
              ) : (
                <GraduationCap size={18} />
              )}
            </div>
            <div className="record-body">
              <strong>{section === 'experience' ? record.role : record.credential}</strong>
              <span>{section === 'experience' ? record.company : record.school}</span>
              <span className="record-dates">{record.dates}</span>
              {record.description && <p>{record.description}</p>}
            </div>
            <div className="row-actions">
              <button
                type="button"
                aria-label="Edit record"
                onClick={() => editNested(section, index)}
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                aria-label="Remove record"
                onClick={() =>
                  c.requestConfirm({
                    title: 'Remove entry',
                    body: 'Remove this record?',
                    onConfirm: () => {
                      setForm({
                        ...form,
                        [section]: form[section].filter((_: any, i: number) => i !== index),
                      });
                      c.requestConfirm(null as any);
                    },
                  })
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {!form[section]?.length && (
          <Empty
            title={`No ${section} records yet`}
            body="Add records that you can verify. Suggestions are never added as facts."
          />
        )}
      </div>
      <Action onClick={() => editNested(section)} secondary icon={<Plus size={15} />}>
        Add {section === 'experience' ? 'experience' : 'education'}
      </Action>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  wide,
  multiline,
  type = 'text',
}: {
  label: string;
  value: any;
  onChange: (s: string) => void;
  wide?: boolean;
  multiline?: boolean;
  type?: string;
}) {
  return (
    <label className={`field ${wide ? 'field-wide' : ''}`}>
      <span>{label}</span>
      {multiline ? (
        <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={4} />
      ) : (
        <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-mark">
        <Layers3 size={19} />
      </div>
      <strong>{title}</strong>
      <span>{body}</span>
      {action}
    </div>
  );
}

function SearchBar({ value, onChange, placeholder = 'Search records' }: any) {
  return (
    <div className="search-box">
      <Search size={16} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function Collection(c: ViewContext & { kind: string }) {
  const cfg = configs[c.kind];
  const rows = c.data[cfg.key] as AnyRecord[];
  const filtered = rows.filter((r) =>
    Object.values(r).join(' ').toLowerCase().includes(c.query.toLowerCase())
  );
  const add = () => c.openDialog({ kind: c.kind });

  return (
    <>
      <Heading
        title={cfg.title}
        description={collectionDescription(c.kind)}
        action={
          <Action onClick={add} icon={<Plus size={16} />}>
            Add {cfg.singular}
          </Action>
        }
      />
      {c.kind === 'skills' && (
        <div className="callout">
          <ShieldCheck size={16} />
          <span>
            <b>Evidence makes a skill credible.</b> Add context you can stand behind; proficiency is
            your own assessment.
          </span>
        </div>
      )}
      {c.kind === 'resumes' && (
        <div className="callout">
          <FileText size={16} />
          <span>
            Organize versions from your verified records. Resume export is a workspace outline in
            this first release, not a generated document.
          </span>
        </div>
      )}
      {c.kind === 'learning' && (
        <div className="callout">
          <BookOpen size={16} />
          <span>Learning paths are your plans, not claims of completed qualifications.</span>
        </div>
      )}
      <div className="collection-toolbar">
        <SearchBar
          value={c.query}
          onChange={c.setQuery}
          placeholder={`Search ${cfg.title.toLowerCase()}`}
        />
        <span>
          {filtered.length} {filtered.length === 1 ? 'record' : 'records'}
        </span>
      </div>
      {filtered.length === 0 ? (
        <Empty
          title={rows.length ? 'No matching records' : `Your ${cfg.title.toLowerCase()} starts here`}
          body={
            rows.length
              ? 'Try a different search.'
              : 'Add a record to begin building your personal career workspace.'
          }
          action={
            !rows.length && (
              <Action onClick={add} icon={<Plus size={15} />}>
                Add {cfg.singular}
              </Action>
            )
          }
        />
      ) : (
        <div className="data-list">
          {filtered.map((r) => (
            <RecordCard
              key={r.id}
              record={r}
              kind={c.kind}
              onEdit={() => c.openDialog({ kind: c.kind, record: r })}
              onDelete={() => c.remove(cfg.key, r.id)}
              onProgress={(v: number) =>
                c.update(
                  cfg.key,
                  rows.map((x) => (x.id === r.id ? { ...x, progress: v } : x))
                )
              }
            />
          ))}
        </div>
      )}
    </>
  );
}

function collectionDescription(kind: string) {
  return (
    {
      skills: 'What you know, how you use it, and what supports the claim.',
      applications: 'A calm, private view of opportunities you have chosen to pursue.',
      resumes: 'Keep role-specific versions anchored to your saved skills.',
      projects: 'A portfolio of real work, context, and outcomes you can discuss.',
      learning: 'Turn a capability gap into a deliberate next step.',
      services: 'Describe work you can deliver from your verified capabilities.',
    } as any
  )[kind];
}

function RecordCard({ record: r, kind, onEdit, onDelete, onProgress }: any) {
  const title = r.name || r.role || r.title || r.credential;
  const meta = [
    r.category,
    r.company || r.provider || r.industry || r.targetRole,
    r.dates || r.completedAt || r.updatedAt,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="record-card">
      <div className="record-mark">
        {kind === 'skills' ? (
          <Layers3 size={17} />
        ) : kind === 'applications' ? (
          <BriefcaseBusiness size={17} />
        ) : kind === 'projects' ? (
          <FolderKanban size={17} />
        ) : kind === 'learning' ? (
          <BookOpen size={17} />
        ) : kind === 'services' ? (
          <Wrench size={17} />
        ) : (
          <FileText size={17} />
        )}
      </div>
      <div className="record-body">
        <div className="record-titleline">
          <strong>{title}</strong>
          {kind === 'skills' && <span className="level">{r.proficiency || 'Not rated'}</span>}
          {kind === 'applications' && (
            <span
              className={`status-pill ${String(r.status).toLowerCase().replace(/\s/g, '-')}`}
            >
              {r.status}
            </span>
          )}
        </div>
        <span>{meta || 'Personal record'}</span>
        {kind === 'skills' && (
          <>
            <div className="skill-meter">
              {[1, 2, 3, 4, 5].map((n) => (
                <i key={n} className={n <= proficiencyScore(r.proficiency) ? 'filled' : ''} />
              ))}
            </div>
            <p>
              {r.evidence || 'No evidence added yet.'} {r.years ? ` · ${r.years} years` : ''}
            </p>
          </>
        )}
        {kind === 'applications' && (
          <p>
            Next step: {r.nextStep || 'Add a next step'} · Applied {r.appliedDate || 'date not set'}
          </p>
        )}
        {kind === 'projects' && (
          <>
            <p>{r.description}</p>
            {r.outcomes && (
              <div className="outcome">
                <TrendingUp size={14} />
                {r.outcomes}
              </div>
            )}
          </>
        )}
        {kind === 'learning' && (
          <>
            <div className="learning-progress">
              <div className="progress-track">
                <span
                  style={{ width: `${Math.max(0, Math.min(100, Number(r.progress) || 0))}%` }}
                />
              </div>
              <span>{r.progress || 0}%</span>
            </div>
            <div className="progress-actions">
              <button
                type="button"
                onClick={() => onProgress(Math.min(100, Number(r.progress) + 10))}
              >
                +10%
              </button>
              <button
                type="button"
                onClick={() => onProgress(Math.max(0, Number(r.progress) - 10))}
              >
                −10%
              </button>
              <span>
                {r.status} · target {r.targetDate || 'not set'}
              </span>
            </div>
          </>
        )}
        {kind === 'services' && (
          <p>
            {r.description} · {r.pricing} · {r.deliveryTime}
          </p>
        )}
        {kind === 'resumes' && (
          <p>Evidence skills: {(r.sourceSkills || []).toString() || 'None linked'}</p>
        )}
      </div>
      <div className="row-actions">
        <button type="button" onClick={onEdit} aria-label={`Edit ${title}`}>
          <Pencil size={15} />
        </button>
        <button type="button" onClick={onDelete} aria-label={`Delete ${title}`}>
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}

function proficiencyScore(value: string | number) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return Math.min(5, numeric);
  const level = String(value).toLowerCase();
  if (level.includes('professional')) return 5;
  if (level.includes('develop')) return 3;
  if (level.includes('learn')) return 1;
  return 0;
}

function Opportunities(c: ViewContext) {
  const types = ['All', 'Employment', 'Freelance', 'Business', 'Development'];
  const records = c.data.opportunities.filter(
    (o) =>
      (c.filter === 'All' || o.category === c.filter) &&
      `${o.title} ${o.company} ${o.industry} ${o.employmentType}`
        .toLowerCase()
        .includes(c.query.toLowerCase())
  );
  const toggleSaved = (o: AnyRecord) =>
    c.update(
      'opportunities',
      c.data.opportunities.map((x) => (x.id === o.id ? { ...x, saved: !x.saved } : x))
    );

  return (
    <>
      <Heading
        title="Opportunity landscape"
        description="Explore possibilities through the lens of your saved skills. These are illustrative examples, not live listings."
        action={
          <Action onClick={() => c.openDialog({ kind: 'opportunities' })} icon={<Plus size={16} />}>
            Add opportunity
          </Action>
        }
      />
      <div className="opportunity-intro">
        <div>
          <span className="tiny-label">YOUR CURRENT SIGNAL</span>
          <strong>
            {c.data.skills.length} saved skills <span>·</span> {c.data.projects.length} project
            records
          </strong>
        </div>
        <button type="button" onClick={() => c.navigate('/skills')} className="text-link">
          Review skills <ArrowRight size={14} />
        </button>
      </div>
      <div className="opportunity-tools">
        <SearchBar
          value={c.query}
          onChange={c.setQuery}
          placeholder="Search role, field, or format"
        />
        <div className="filter-pills">
          {types.map((t) => (
            <button
              type="button"
              key={t}
              className={c.filter === t ? 'selected' : ''}
              onClick={() => c.setFilter(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="opportunity-list">
        {records.map((o) => (
          <article className="opportunity-card" key={o.id}>
            <div className="opportunity-card-top">
              <div className="company-monogram">{o.company?.slice(0, 1) || 'O'}</div>
              <div className="opportunity-title">
                <div className="tiny-label">
                  {String(o.category || 'Opportunity').toUpperCase()} · {o.industry}
                </div>
                <h3>{o.title}</h3>
                <span>
                  {o.company} <i /> {o.workplace}
                </span>
              </div>
              <div className="compatibility">
                <strong>{o.compatibility}%</strong>
                <span>example score</span>
              </div>
            </div>
            <div className="opportunity-details">
              <div>
                <span className="detail-label">Compensation / scope</span>
                <strong>{o.salary}</strong>
              </div>
              <div>
                <span className="detail-label">Format</span>
                <strong>{o.employmentType}</strong>
              </div>
            </div>
            <div className="fit-explanation">
              <div>
                <Check size={14} />
                <span>
                  Related saved skills:{' '}
                  {c.data.skills
                    .slice(0, 2)
                    .map((s) => s.name)
                    .join(' and ') || 'none added yet'}
                  .
                </span>
              </div>
              {o.missingSkills?.length > 0 && (
                <div className="gap">
                  <ArrowDownRight size={14} />
                  <span>
                    Potential growth area: {o.missingSkills.join(', ')}. This is a suggestion, not a
                    qualification you lack.
                  </span>
                </div>
              )}
            </div>
            <div className="opportunity-actions">
              <button
                type="button"
                className={`button ${o.saved ? 'button-secondary saved' : 'button-secondary'}`}
                onClick={() => toggleSaved(o)}
              >
                {o.saved ? <Heart size={15} fill="currentColor" /> : <Heart size={15} />}{' '}
                {o.saved ? 'Saved' : 'Save for later'}
              </button>
              <button
                type="button"
                className="text-link"
                onClick={() =>
                  c.openDialog({
                    kind: 'application',
                    record: {
                      role: o.title,
                      company: o.company,
                      status: 'Considering',
                      appliedDate: new Date().toISOString().slice(0, 10),
                      nextStep: '',
                      notes: `Saved from illustrative ${String(o.category || '').toLowerCase()} match.`,
                    },
                  })
                }
              >
                Track an application <ArrowRight size={14} />
              </button>
              <span className="opportunity-manage">
                <button
                  type="button"
                  onClick={() => c.openDialog({ kind: 'opportunities', record: o })}
                  aria-label={`Edit ${o.title}`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => c.remove('opportunities', o.id)}
                  aria-label={`Delete ${o.title}`}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          </article>
        ))}
      </div>
      {!records.length && (
        <Empty
          title="No matches in this view"
          body="Try another search or category. Add skills to make the reasoning more useful."
        />
      )}
      <div className="callout soft">
        <CircleHelp size={16} />
        <span>
          Example scores are placeholders, not live matching. Real fit needs current listing
          requirements and a profile you have confirmed.
        </span>
      </div>
    </>
  );
}

function RecordDialog({
  dialog,
  onClose,
  onSave,
}: {
  dialog: { kind: string; record?: AnyRecord };
  onClose: () => void;
  onSave: (key: keyof Data, r: AnyRecord) => void;
}) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const nested = ['experience', 'education'].includes(dialog.kind);
  const isEdit = !!dialog.record?.id;
  const fields = nested
    ? dialog.kind === 'experience'
      ? ['company', 'role', 'dates', 'description']
      : ['school', 'credential', 'dates']
    : configs[dialog.kind]?.fields || [
        'role',
        'company',
        'status',
        'appliedDate',
        'nextStep',
        'notes',
      ];
  const [values, setValues] = useState<AnyRecord>(() => ({
    ...(dialog.record || {}),
    ...(dialog.kind === 'opportunities' && !dialog.record
      ? { compatibility: 50, category: 'Employment', saved: false }
      : {}),
  }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (nested) {
      window.dispatchEvent(
        new CustomEvent('xelime-nested-record', { detail: { kind: dialog.kind, record: values } })
      );
      onClose();
      return;
    }
    const kind = dialog.kind === 'application' ? 'applications' : dialog.kind;
    const arrayFields = ['sourceSkills', 'skills', 'missingSkills'];
    const normalized = { ...values };
    arrayFields.forEach((k) => {
      if (typeof normalized[k] === 'string') {
        normalized[k] = normalized[k]
          .split(',')
          .map((x: string) => x.trim())
          .filter(Boolean);
      }
    });
    if (['years', 'progress', 'compatibility'].some((k) => normalized[k] !== undefined)) {
      ['years', 'progress', 'compatibility'].forEach((k) => {
        if (normalized[k] !== undefined && normalized[k] !== '') {
          normalized[k] = Number(normalized[k]);
        }
      });
    }
    onSave(configs[kind] ? configs[kind].key : 'applications', normalized);
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="modal-head">
          <div>
            <span className="tiny-label">{isEdit ? 'UPDATE RECORD' : 'NEW RECORD'}</span>
            <h2 id="dialog-title">
              {isEdit ? 'Edit' : 'Add'}{' '}
              {dialog.kind === 'experience'
                ? 'experience'
                : dialog.kind === 'education'
                ? 'education'
                : configs[dialog.kind]?.singular || 'application'}
            </h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <div className="modal-fields">
          {fields.map((field) => (
            <React.Fragment key={field}>
              <Field
                label={
                  labelize(field) +
                  (['skills', 'sourceSkills'].includes(field) ? ' (comma separated)' : '')
                }
                value={values[field] ?? ''}
                type={['appliedDate', 'updatedAt', 'targetDate'].includes(field) ? 'date' : 'text'}
                wide={['description', 'evidence', 'notes', 'outcomes'].includes(field)}
                multiline={['description', 'evidence', 'notes', 'outcomes'].includes(field)}
                onChange={(v) => setValues({ ...values, [field]: v })}
              />
            </React.Fragment>
          ))}
        </div>
        <div className="modal-foot">
          <span>Stored only in this browser.</span>
          <button type="button" className="button button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button button-primary" type="submit">
            <Check size={15} />
            {isEdit ? 'Save changes' : 'Add record'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Assistant({
  isIntelligenceOpen = false,
  onToggleIntelligence,
  onOpenIntelligence,
}: {
  isIntelligenceOpen?: boolean;
  onToggleIntelligence?: () => void;
  onOpenIntelligence?: () => void;
}) {
  const modes = [
    ['Identity editor', 'Shape a clear, evidence-based professional introduction.', UserRound],
    ['Skills mapper', 'Connect capabilities to your experience and project evidence.', Layers3],
    ['Opportunity reader', 'Understand fit, trade-offs, and areas to explore.', Target],
    ['Application coach', 'Prepare focused notes and thoughtful next steps.', BriefcaseBusiness],
    ['Resume editor', 'Organize verified evidence around a particular role.', FileText],
    ['Growth planner', 'Turn a skill goal into a manageable learning plan.', TrendingUp],
  ];
  const launchConsole = () => {
    if (onOpenIntelligence) {
      onOpenIntelligence();
    } else if (onToggleIntelligence) {
      onToggleIntelligence();
    }
  };

  return (
    <>
      <Heading
        title="XELIME Intelligence"
        description="Your persistent AI career console, available from any tab with preserved chat history and context."
        action={
          onToggleIntelligence ? (
            <button
              type="button"
              className="button button-primary"
              onClick={onToggleIntelligence}
            >
              <Sparkles size={15} />
              {isIntelligenceOpen ? 'Hide Intelligence' : 'Open XELIME Intelligence'}
            </button>
          ) : undefined
        }
      />
      <div className="assistant-preview">
        <div className="assistant-icon">
          <Sparkles size={21} />
        </div>
        <div>
          <span className="preview-label">CONNECTED · SHARED FLOATING CONSOLE</span>
          <h2>{isIntelligenceOpen ? 'XELIME Intelligence is open.' : 'Ready when you need it.'}</h2>
          <p>
            Launch XELIME Intelligence from the top bar or below to run career analysis, map skill
            gaps, inspect projects, or sync Notion records without leaving the Main UI.
          </p>
        </div>
        <span className="status-pill interviewing">
          {isIntelligenceOpen ? 'Open' : 'Connected'}
        </span>
      </div>
      <div className="mode-grid">
        {modes.map(([name, copy, Icon]: any, i) => (
          <button
            type="button"
            className="mode-card mode-card-btn"
            key={name}
            onClick={launchConsole}
          >
            <span className="mode-index">0{i + 1}</span>
            <Icon size={19} />
            <h3>{name}</h3>
            <p>{copy}</p>
            <span className="mode-status">Launch in XELIME Intelligence →</span>
          </button>
        ))}
      </div>
      <div className="callout soft">
        <ShieldCheck size={16} />
        <span>
          Chat history, active intelligence mode, and window position stay synced seamlessly even if
          you switch between Main UI and Backend Dev.
        </span>
      </div>
    </>
  );
}

function Analytics(c: ViewContext) {
  const skills = c.data.skills;
  const totalProjects = c.data.projects.length;
  const grouped = skills.reduce((acc: AnyRecord, s) => {
    acc[s.category || 'Other'] = (acc[s.category || 'Other'] || 0) + 1;
    return acc;
  }, {});
  const max = Math.max(...Object.values(grouped).map(Number), 1);
  const stages = ['Considering', 'Applied', 'Interviewing', 'Offer', 'Closed'];

  return (
    <>
      <Heading
        title="Career insights"
        description="A compact read of the records you have saved. No external or live market data is used."
      />
      <div className="metrics-grid analytics-metrics">
        <Metric
          label="Skills in your map"
          value={skills.length}
          note="across saved categories"
          icon={Layers3}
        />
        <Metric
          label="Projects captured"
          value={totalProjects}
          note="portfolio records"
          icon={FolderKanban}
        />
        <Metric
          label="Learning progress"
          value={`${Math.round(
            c.data.learning.reduce((n, l) => n + Number(l.progress || 0), 0) /
              Math.max(c.data.learning.length, 1)
          )}%`}
          note="average of saved plans"
          icon={BookOpen}
        />
        <Metric
          label="Saved opportunities"
          value={c.data.opportunities.filter((o) => o.saved).length}
          note="illustrative matches"
          icon={Heart}
        />
      </div>
      <div className="analytics-grid">
        <section className="panel chart-panel">
          <div className="panel-head">
            <div>
              <span className="tiny-label">SKILL DISTRIBUTION</span>
              <h3>Where your capabilities cluster</h3>
            </div>
            <Layers3 size={17} />
          </div>
          {Object.keys(grouped).length ? (
            Object.entries(grouped).map(([name, count]: any) => (
              <div className="bar-row" key={name}>
                <span>{name}</span>
                <div className="progress-track">
                  <span style={{ width: `${(count / max) * 100}%` }} />
                </div>
                <b>{count}</b>
              </div>
            ))
          ) : (
            <Empty
              title="No skill signals yet"
              body="Add skills to see how your experience is distributed."
            />
          )}
        </section>
        <section className="panel chart-panel">
          <div className="panel-head">
            <div>
              <span className="tiny-label">APPLICATION PIPELINE</span>
              <h3>Movement by stage</h3>
            </div>
            <BriefcaseBusiness size={17} />
          </div>
          {stages.map((stage) => {
            const count = c.data.applications.filter((a) => a.status === stage).length;
            return (
              <div className="pipeline-row" key={stage}>
                <span>{stage}</span>
                <div className="pipeline-meter">
                  <i style={{ width: `${Math.min(count * 30, 100)}%` }} />
                </div>
                <b>{count}</b>
              </div>
            );
          })}
        </section>
      </div>
      <div className="insight-note">
        <div className="insight-mark">
          <Lightbulb size={17} />
        </div>
        <div>
          <span className="tiny-label">A THOUGHT TO CONSIDER</span>
          <strong>
            {skills.length && skills.some((s) => !s.evidence)
              ? 'Some skills have no evidence attached.'
              : 'A strong record makes your story easier to stand behind.'}
          </strong>
          <p>
            {skills.length && skills.some((s) => !s.evidence)
              ? 'Add a project, example, or context to make those skills more useful.'
              : 'Keep adding specific examples and outcomes. This workspace only summarizes what you save.'}
          </p>
        </div>
        <button type="button" onClick={() => c.navigate('/skills')} className="text-link">
          Review evidence <ArrowRight size={14} />
        </button>
      </div>
    </>
  );
}

function SettingsPage(c: ViewContext) {
  const { data } = c;
  return (
    <>
      <Heading
        title="Workspace settings"
        description="Your preferences and data controls. Everything in this first version lives in this browser."
      />
      <section className="panel settings-panel">
        <div className="panel-head">
          <div>
            <span className="tiny-label">APPEARANCE</span>
            <h3>Choose your working light</h3>
          </div>
          {data.theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
        </div>
        <div className="setting-row">
          <div>
            <strong>Color theme</strong>
            <span>Switch between soft light and charcoal dark.</span>
          </div>
          <div className="theme-switch">
            <button
              type="button"
              className={data.theme === 'light' ? 'selected' : ''}
              onClick={() => c.update('theme', 'light')}
            >
              <Sun size={15} />
              Light
            </button>
            <button
              type="button"
              className={data.theme === 'dark' ? 'selected' : ''}
              onClick={() => c.update('theme', 'dark')}
            >
              <Moon size={15} />
              Dark
            </button>
          </div>
        </div>
      </section>
      <section className="panel settings-panel">
        <div className="panel-head">
          <div>
            <span className="tiny-label">DATA CONTROL</span>
            <h3>Your records, your call</h3>
          </div>
          <Download size={18} />
        </div>
        <div className="setting-row">
          <div>
            <strong>Cloud sync</strong>
            <span>
              Saved to your private Cloud Firestore workspace, synced across devices when
              you are signed in.
            </span>
          </div>
          <span className="local-tag">
            <span className="online-dot" />
            Active
          </span>
        </div>
        <div className="setting-row">
          <div>
            <strong>Export workspace</strong>
            <span>Download a JSON copy of your career records and preferences.</span>
          </div>
          <Action onClick={c.exportData} secondary icon={<Download size={15} />}>
            Export data
          </Action>
        </div>
        <div className="setting-row">
          <div>
            <strong>Reset sample workspace</strong>
            <span>Restore editable examples. This replaces your current browser records.</span>
          </div>
          <button type="button" className="button button-danger" onClick={c.resetData}>
            <Trash2 size={15} />
            Reset data
          </button>
        </div>
      </section>
      <section className="panel settings-panel">
        <div className="panel-head">
          <div>
            <span className="tiny-label">CONNECTIONS</span>
            <h3>No integrations connected</h3>
          </div>
          <ExternalLink size={18} />
        </div>
        <div className="integration-row">
          <div className="integration-icon">
            <Sparkles size={17} />
          </div>
          <div>
            <strong>AI Career Assistant</strong>
            <span>Not connected · Preview only</span>
          </div>
          <span className="status-pill">Unavailable</span>
        </div>
        <div className="integration-row">
          <div className="integration-icon">
            <BriefcaseBusiness size={17} />
          </div>
          <div>
            <strong>Job boards & opportunity feeds</strong>
            <span>No external listings or live market data</span>
          </div>
          <span className="status-pill">Not connected</span>
        </div>
        <div className="integration-row">
          <div className="integration-icon">
            <Layers3 size={17} />
          </div>
          <div>
            <strong>Cloud sync</strong>
            <span>Not available in this local-only first version</span>
          </div>
          <span className="status-pill">Local only</span>
        </div>
      </section>
      <div className="settings-footnote">
        <ShieldCheck size={16} />
        <span>
          Privacy note: there is no account, server sync, analytics backend, or AI connection in
          this release. Your edits remain on this device.
        </span>
      </div>
    </>
  );
}

type FeedJob = {
  id: string;
  title: string;
  company: string;
  logo: string;
  color: string;
  sector: string;
  loc: string;
  remote: string;
  type: 'fulltime' | 'contract';
  level: string;
  pay: [number, number];
  years: string;
  ago: number;
  applicants: number;
  alumni: number;
  sponsor: boolean;
  skills: string[];
  match: number;
  tagline?: string;
  summary?: string;
};

const LIVE_JOBS_STORE = 'xelime-live-jobs-v1';
const LIVE_SEARCH_QUERY = 'creative production, CAD drafting, print shop, remote support';
const LIVE_SEARCH_LOCATION = 'Columbus, OH';
const FEED_COLORS = ['#e11d1d', '#0ea5b7', '#1d4ed8', '#7c3aed', '#059669', '#d97706', '#db2777', '#2563eb'];

function collectUserSkillNames(): Set<string> {
  const out = new Set<string>();
  try {
    const raw = getUserStoreValue(STORE);
    if (raw) {
      const ws = JSON.parse(raw);
      (Array.isArray(ws?.skills) ? ws.skills : []).forEach((s: AnyRecord | string) => {
        if (typeof s === 'string') out.add(s.toLowerCase());
        else if (s?.name) out.add(String(s.name).toLowerCase());
      });
    }
  } catch {
    // Ignore corrupt workspace data
  }
  return out;
}

function parseSalaryToK(salary: string): [number, number] {
  const text = (salary || '').toLowerCase();
  const nums = (text.match(/\d[\d,]*(?:\.\d+)?/g) || [])
    .map((n) => parseFloat(n.replace(/,/g, '')))
    .filter((n) => n > 0);
  if (!nums.length) return [0, 0];
  const mult = /(hour|hr)/.test(text) ? 2080 : /month/.test(text) ? 12 : 1000;
  const values = nums.slice(0, 2).map((n) => Math.max(1, Math.round((n * mult) / 1000)));
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return hi === lo ? [lo, lo + 10] : [lo, hi];
}

function toFeedJob(job: JobFixture, index: number, userSkills: Set<string>): FeedJob {
  const skills = (job.skills || []).slice(0, 6);
  const hits = skills.filter((s) => userSkills.has(String(s).toLowerCase())).length;
  const match = skills.length ? Math.max(15, Math.round((hits / skills.length) * 100)) : 50;
  const remote =
    job.remoteType === 'remote' ? 'Remote' : job.remoteType === 'hybrid' ? 'Hybrid' : 'Onsite';
  const level = /sen|lead|principal|staff/i.test(job.experienceLevel || '')
    ? 'senior'
    : /entry|junior/i.test(job.experienceLevel || '')
      ? 'entry'
      : 'mid';
  const posted = job.postedAt ? Date.parse(job.postedAt) : NaN;
  const ago = Number.isFinite(posted) ? Math.max(0.5, (Date.now() - posted) / 3600000) : 24;
  return {
    id: 'live-' + job.id,
    title: job.title || 'Untitled role',
    company: job.company || 'Unknown company',
    logo: (job.company || '?').trim().charAt(0).toUpperCase(),
    color: FEED_COLORS[index % FEED_COLORS.length],
    sector: job.source ? `${job.source} · Live search` : 'Live search',
    loc: job.location || '—',
    remote,
    type: /contract|temp|part-time/i.test(`${job.experienceLevel || ''} ${job.lane || ''}`)
      ? 'contract'
      : 'fulltime',
    level,
    pay: parseSalaryToK(job.salary || ''),
    years: job.experienceLevel || '—',
    ago,
    applicants: 0,
    alumni: 0,
    sponsor: false,
    skills,
    match,
    tagline: job.summary || '',
    summary: job.summary || (job.description || '').slice(0, 400),
  };
}

function JobFeedPrototypePanel({ theme }: { theme: 'light' | 'dark' }) {
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [fetchingLive, setFetchingLive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const storeReady = useUserStoreReady();

  const restoreFeedState = React.useCallback(() => {
    const raw = getUserStoreValue('xelime-job-feed-state-v1');
    if (raw) {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'xelime:feed-state-restore', state: JSON.parse(raw) },
          window.location.origin
        );
      } catch {
        // Ignore corrupt feed state
      }
    }
    const liveRaw = getUserStoreValue(LIVE_JOBS_STORE);
    if (liveRaw) {
      try {
        const jobs = JSON.parse(liveRaw);
        if (Array.isArray(jobs) && jobs.length) {
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'xelime:live-jobs', jobs },
            window.location.origin
          );
        }
      } catch {
        // Ignore corrupt live jobs
      }
    }
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !event.data) return;
      if (event.data.type === 'xelime:feed-state-request') {
        restoreFeedState();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [restoreFeedState]);

  useEffect(() => {
    if (!storeReady) return;
    restoreFeedState();
  }, [frameKey, storeReady, restoreFeedState]);

  const fetchLiveJobs = React.useCallback(async () => {
    if (fetchingLive) return;
    setFetchingLive(true);
    setLiveStatus(null);
    try {
      const userSkills = collectUserSkillNames();
      const res = await authFetch('/api/search-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: LIVE_SEARCH_QUERY,
          location: LIVE_SEARCH_LOCATION,
          source: 'auto',
        }),
      });
      if (!res.ok) throw new Error(`Live job search failed (${res.status}).`);
      const payload = await res.json();
      const fixtures: JobFixture[] = Array.isArray(payload?.jobs) ? payload.jobs : [];
      if (!fixtures.length) {
        setLiveStatus('No live jobs returned. Add a provider key in Settings → APIs or try again later.');
        return;
      }
      const mapped = fixtures.slice(0, 40).map((job, index) => toFeedJob(job, index, userSkills));
      setUserStoreValue(LIVE_JOBS_STORE, JSON.stringify(mapped));
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'xelime:live-jobs', jobs: mapped, skills: [...userSkills] },
        window.location.origin
      );
      setLiveStatus(`Added ${mapped.length} live jobs to the feed.`);
    } catch (err) {
      setLiveStatus(err instanceof Error ? err.message : 'Live job search failed.');
    } finally {
      setFetchingLive(false);
    }
  }, [fetchingLive]);

  // Auto-populate the feed the first time it opens with nothing cached.
  const autoFetchedRef = React.useRef(false);
  React.useEffect(() => {
    if (!storeReady || autoFetchedRef.current) return;
    autoFetchedRef.current = true;
    const liveRaw = getUserStoreValue(LIVE_JOBS_STORE);
    const cached = liveRaw ? JSON.parse(liveRaw) : null;
    if (Array.isArray(cached) && cached.length) return; // restoreFeedState already sent cached jobs
    fetchLiveJobs();
  }, [storeReady, fetchLiveJobs]);

  const syncTheme = (nextTheme: 'light' | 'dark') => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc?.documentElement) {
        doc.documentElement.setAttribute('data-theme', nextTheme);
      }
    } catch {
      // Ignore if frame hasn't finished mounting
    }
  };

  useEffect(() => {
    syncTheme(theme);
  }, [theme]);

  return (
    <>
      <Heading
        title="Job Feed"
        description="Interactive job feed prototype with skill-match scoring, role drawer, and Orion copilot."
        action={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Action
              secondary
              icon={<Sparkles size={15} />}
              onClick={() => {
                void fetchLiveJobs();
              }}
            >
              {fetchingLive ? 'Searching…' : 'Fetch live jobs'}
            </Action>
            <Action
              secondary
              icon={<RefreshCw size={15} />}
              onClick={() => setFrameKey((k) => k + 1)}
            >
              Reload feed
            </Action>
            <a
              href="/assets/aistudio/Job_Feed_Prototype_40f07e5a.html"
              target="_blank"
              rel="noopener noreferrer"
              className="button button-primary"
            >
              <ExternalLink size={15} />
              Open standalone
            </a>
          </div>
        }
      />
      {liveStatus && (
        <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
          {liveStatus}
        </p>
      )}
      <div
        style={{
          border: '1px solid hsl(var(--border))',
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'hsl(var(--card))',
          marginTop: '12px',
        }}
      >
        <iframe
          key={frameKey}
          ref={iframeRef}
          src="/assets/aistudio/Job_Feed_Prototype_40f07e5a.html"
          title="Job Feed Prototype"
          onLoad={() => {
            syncTheme(theme);
            restoreFeedState();
          }}
          style={{
            width: '100%',
            height: 'max(760px, calc(100dvh - 235px))',
            border: 0,
            display: 'block',
          }}
        />
      </div>
    </>
  );
}

function NotFound({ navigate }: { navigate: (href: string) => void }) {
  return (
    <div className="not-found">
      <span className="tiny-label">404 · NOT IN YOUR WORKSPACE</span>
      <h1>This path is a blank page.</h1>
      <p>Return to your career overview and pick up where you left off.</p>
      <button type="button" className="button button-primary" onClick={() => navigate('/')}>
        Back to overview <ArrowRight size={15} />
      </button>
    </div>
  );
}
