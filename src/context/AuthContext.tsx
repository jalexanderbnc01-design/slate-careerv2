import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  auth,
  signInWithGoogle,
  signOutFirebase,
} from "../firebase/client";
import {
  migrateLocalStorageToFirestore,
  type MigrationSummary,
} from "../utils/firestoreMigration";
import { hydrateUserStore, resetUserStore } from "../utils/userStore";
import { ShieldCheck, LogIn, LogOut, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

export type { MigrationSummary };

interface AuthContextValue {
  user: User | null;
  authLoading: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  staleWarning: string | null;
  reportStaleWarning: (msg: string) => void;
  clearStaleWarning: () => void;
  migrationSummary: MigrationSummary | null;
  setMigrationSummary: (summary: MigrationSummary | null) => void;
  authDebugLog: string[];
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [staleWarning, setStaleWarning] = useState<string | null>(null);
  const [migrationSummary, setMigrationSummary] =
    useState<MigrationSummary | null>(null);

  const [authDebugLog, setAuthDebugLog] = useState<string[]>([]);
  const pushAuthDebug = (msg: string) => {
    const stamp = new Date().toISOString().slice(11, 23);
    const line = `[${stamp}] ${msg}`;
    console.info("[auth-debug]", line);
    setAuthDebugLog((prev) => [...prev.slice(-19), line]);
  };

  const migrationRunForRef = useRef<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      (nextUser) => {
        pushAuthDebug(
          nextUser
            ? `onAuthStateChanged: signed in as ${nextUser.email || nextUser.uid}`
            : "onAuthStateChanged: signed out (user = null)"
        );
        setUser(nextUser);
        setAuthLoading(false);
        setAuthError(null);
        if (nextUser && migrationRunForRef.current !== nextUser.uid) {
          migrationRunForRef.current = nextUser.uid;
          hydrateUserStore(nextUser.uid)
            .then(() => migrateLocalStorageToFirestore(nextUser.uid))
            .then((summary) => {
              if (summary.migratedCount > 0 || summary.legacyKeysCleared > 0) {
                setMigrationSummary(summary);
              }
            })
            .catch((err) => {
              console.warn("One-time Firestore migration failed:", err);
            });
        }
        if (!nextUser) {
          resetUserStore();
        }
      },
      (err) => {
        setAuthError(err?.message || "Authentication listener failed.");
        setAuthLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const signIn = async () => {
    setAuthError(null);
    pushAuthDebug("signIn() clicked: opening Google Identity Services token popup...");
    try {
      await signInWithGoogle();
      pushAuthDebug("Google token flow: completed, Firebase sign-in resolved.");
    } catch (err: any) {
      pushAuthDebug(`signIn ERROR: ${err?.code || ""} ${err?.message || err}`);
      setAuthError(err?.message || "Google sign-in failed.");
    }
  };

  const signOut = async () => {
    setAuthError(null);
    try {
      await signOutFirebase();
    } catch (err: any) {
      setAuthError(err?.message || "Sign-out failed.");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authLoading,
        authError,
        signIn,
        signOut,
        staleWarning,
        reportStaleWarning: setStaleWarning,
        clearStaleWarning: () => setStaleWarning(null),
        migrationSummary,
        setMigrationSummary,
        authDebugLog,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return ctx;
}

export function AuthStatusBanner() {
  const {
    user,
    signOut,
    staleWarning,
    clearStaleWarning,
    migrationSummary,
    setMigrationSummary,
  } = useAuth();

  if (!user) return null;

  return (
    <>
      {staleWarning && (
        <div className="bg-amber-950/90 border-b border-amber-700/70 px-4 py-2 text-xs text-amber-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{staleWarning}</span>
          </div>
          <button
            type="button"
            onClick={clearStaleWarning}
            className="px-2 py-0.5 rounded bg-amber-900/70 hover:bg-amber-800 text-[11px] font-mono cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
      {migrationSummary && migrationSummary.migratedCount > 0 && (
        <div className="bg-emerald-950/85 border-b border-emerald-800/60 px-4 py-2 text-xs text-emerald-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Imported {migrationSummary.migratedCount} local record(s) into Cloud Firestore and retired{" "}
              {migrationSummary.legacyKeysCleared} legacy localStorage key(s).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMigrationSummary(null)}
            className="px-2 py-0.5 rounded bg-emerald-900/70 hover:bg-emerald-800 text-[11px] font-mono cursor-pointer"
          >
            OK
          </button>
        </div>
      )}
      <div className="bg-slate-900/95 border-b border-slate-800 px-4 py-1.5 flex items-center justify-between gap-3 text-[11px] text-slate-300">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate font-mono">
            Firestore Sync · {user.email || user.uid}
          </span>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono text-[10px] flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <LogOut className="w-3 h-3" />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, authLoading, authError, signIn, authDebugLog } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
        <p className="text-xs font-mono text-slate-400">
          Verifying Firebase session...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6 shadow-2xl">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-blue-950/60 border border-blue-800/50 text-blue-300 text-[11px] font-mono uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Cloud Firestore · User Scoped</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Career Engine
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sign in with Google to sync your Live Jobs, Lanes, Tracker, Job Rail, Portfolio Proof, Clay leads, and Notion workspace in Cloud Firestore with offline support.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/60 text-xs text-rose-200">
              {authError}
            </div>
          )}

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
            <p className="font-semibold text-slate-300 mb-1">Browser will ask for permission</p>
            <p>
              When you sign in, watch for a cookie or tracking icon at the <span className="font-mono text-slate-200">left of the address bar</span>. If prompted, choose <span className="text-slate-200">Allow</span> so Google and Firebase can share the sign-in session. If a sign-in attempt silently returns to this screen, click that icon, allow cookies for <span className="font-mono">accounts.google.com</span> and <span className="font-mono">slate-512218.firebaseapp.com</span>, then sign in again.
            </p>
          </div>

          <button
            type="button"
            onClick={signIn}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign in with Google</span>
          </button>

          {authDebugLog.length > 0 && (
            <pre className="p-2 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-400 font-mono overflow-auto max-h-40 whitespace-pre-wrap">
              {authDebugLog.join("\n")}
            </pre>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
