import React, { useEffect, useRef, useState } from 'react';
import { supabase, hasValidSupabaseConfig } from './lib/supabase';
import { api } from './lib/api';

import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import PreScreensView from './components/PreScreensView';
import ComplianceView from './components/ComplianceView';
import FeedbackView from './components/FeedbackView';
import TreatmentsView from './components/TreatmentsView';
import Auth from './components/Auth';

import { LogOut, Loader2, AlertCircle, Zap, RefreshCw } from 'lucide-react';

type SessionState = any | null; // null=logged out, object=logged in

const App = () => {
  const [session, setSession] = useState<SessionState>(null);
  const [authReady, setAuthReady] = useState(false);

  const [profile, setProfile] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);

  const [currentView, setCurrentView] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [dataError, setDataError] = useState<string | null>(null);

  const hasConfig = hasValidSupabaseConfig();

  // Prevent overlapping fetches
  const fetchingRef = useRef(false);

  const fetchProfileAndData = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    setDataError(null);

    try {
      const me = await api.getMe(); // requires Bearer token
      setProfile(me);

      const full = await api.getFullDashboardData(me.clinic.id);
      setDashboardData(full);
    } catch (e: any) {
      console.error('[fetchProfileAndData] failed', e);
      setProfile(null);
      setDashboardData(null);

      const msg =
        e?.message ||
        (typeof e === 'string' ? e : 'Failed to load clinic data. Check Netlify functions + auth token.');
      setDataError(msg);
    } finally {
      fetchingRef.current = false;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const stripCodeFromUrl = () => {
      const u = new URL(window.location.href);
      if (u.searchParams.has('code')) {
        u.searchParams.delete('code');
        window.history.replaceState({}, document.title, u.toString());
      }
    };

    const exchangeIfCodePresent = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      if (!code) return;

      // ✅ Try “full URL” first (some builds expect it)
      // ✅ If that fails, retry with “code only” (other builds expect that)
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) throw error;
      } catch (err1) {
        console.warn('[exchangeCodeForSession] URL mode failed; retrying with code only', err1);
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } catch (err2) {
          console.error('[exchangeCodeForSession] code-only mode failed', err2);
        }
      }

      // Always remove code so refresh doesn’t keep re-processing
      stripCodeFromUrl();

      // If user landed on /auth/callback, bounce to /
      if (window.location.pathname === '/auth/callback') {
        window.location.replace('/');
      }
    };

    const bootstrap = async () => {
      try {
        if (!hasConfig) {
          if (!cancelled) {
            setSession(null);
            setAuthReady(true);
          }
          return;
        }

        // ✅ Critical: exchange code BEFORE getSession()
        await exchangeIfCodePresent();

        // ✅ Now hydrate session (refresh-safe)
        const { data, error } = await supabase.auth.getSession();
        if (error) console.error('[getSession]', error);

        const s = data?.session ?? null;

        if (!cancelled) {
          setSession(s);
          setAuthReady(true);
        }

        if (s) {
          await fetchProfileAndData();
        }
      } catch (e) {
        console.error('[bootstrap] failed', e);
        if (!cancelled) {
          setSession(null);
          setAuthReady(true);
        }
      }
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (cancelled) return;

      setSession(newSession ?? null);
      setAuthReady(true);

      if (newSession) {
        await fetchProfileAndData();
      } else {
        setProfile(null);
        setDashboardData(null);
        setDataError(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasConfig]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleNavigate = (view: string) => {
    setCurrentView(view);
    setSidebarOpen(false);
    window.history.pushState({}, '', `/${view}`);
  };

  const handleUpdateRecord = (id: string, updates: any) => {
    if (!dashboardData) return;
    const updated = dashboardData.preScreens.map((r: any) =>
      r.id === id ? { ...r, ...updates } : r
    );
    setDashboardData({ ...dashboardData, preScreens: updated });
  };

  // 1) Boot screen ONLY while auth is initializing
  if (hasConfig && !authReady) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6 text-center">
        <div className="mb-12">
          <span className="text-5xl font-serif font-bold italic text-uanco-900 block mb-2">uanco.</span>
          <div className="h-1 w-12 bg-uanco-900 mx-auto rounded-full"></div>
        </div>
        <div className="space-y-6">
          <Loader2 className="h-12 w-12 text-uanco-900 animate-spin mx-auto opacity-50" />
          <p className="text-uanco-400 text-[10px] font-bold uppercase tracking-[0.3em] animate-pulse">
            Establishing Connection
          </p>
        </div>
      </div>
    );
  }

  // 2) Logged out -> Auth (and config warning)
  if (!session) {
    if (!hasConfig) {
      return (
        <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6 text-center">
          <div className="mb-10">
            <span className="text-5xl font-serif font-bold italic text-uanco-900 block mb-2">uanco.</span>
            <div className="h-1 w-12 bg-uanco-900 mx-auto rounded-full"></div>
          </div>

          <div className="max-w-md w-full bg-white border border-uanco-100 rounded-3xl p-6 shadow-soft text-left">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="text-amber-700" size={18} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-uanco-900">Configuration missing</p>
                <p className="text-[11px] text-uanco-400">
                  Supabase keys not detected in this environment. Add Netlify env vars and redeploy.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 w-full max-w-md">
            <Auth />
          </div>
        </div>
      );
    }

    return <Auth />;
  }

  const renderView = () => {
    if (!dashboardData) {
      return (
        <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
          <Loader2 className="animate-spin text-uanco-200" size={32} />
          <p className="text-[11px] text-uanco-400 uppercase tracking-widest font-bold">
            Loading clinic data…
          </p>

          {dataError && (
            <div className="mt-6 max-w-xl w-full bg-white border border-rose-100 rounded-3xl p-6 shadow-soft text-left">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                  <AlertCircle className="text-rose-600" size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-uanco-900 mb-1">
                    Clinic data load failed
                  </p>
                  <p className="text-[11px] text-uanco-400 break-words">{dataError}</p>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => fetchProfileAndData()}
                      className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl bg-uanco-900 text-white hover:opacity-90"
                    >
                      <RefreshCw size={14} /> Retry
                    </button>
                    <button
                      onClick={() => window.location.reload()}
                      className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl border border-uanco-100 text-uanco-600 hover:bg-uanco-50"
                    >
                      Refresh
                    </button>
                  </div>

                  <p className="mt-4 text-[10px] text-uanco-300 uppercase tracking-widest">
                    If this persists: Netlify functions are returning 401/403 OR /me isn’t returning clinic fields.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    const clinicName = profile ? profile.clinic.name : 'Clinic';

    switch (currentView) {
      case 'overview':
        return <Dashboard clinicId={clinicName} onNavigate={handleNavigate} />;
      case 'prescreens':
        return (
          <PreScreensView
            records={dashboardData.preScreens}
            dropOffs={dashboardData.dropOffs}
            onUpdateRecord={handleUpdateRecord}
          />
        );
      case 'ai-insight':
        return <TreatmentsView stats={dashboardData.metrics.treatmentStats} questions={dashboardData.questions} />;
      case 'compliance':
        return (
          <ComplianceView
            records={dashboardData.preScreens}
            failReasons={dashboardData.metrics.failReasons}
            onUpdateRecord={handleUpdateRecord}
          />
        );
      case 'feedback':
        return <FeedbackView />;
      default:
        return <Dashboard clinicId={clinicName} onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-uanco-50 font-sans text-uanco-900 selection:bg-uanco-900 selection:text-white">
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        features={(profile && profile.clinic.enabled_features) || []}
        onOpenAdmin={() => {}}
      />

      <main className="flex-1 md:ml-64 min-h-screen flex flex-col transition-all duration-300">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-uanco-100 flex items-center justify-between px-6 md:px-8 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-uanco-400 hover:text-uanco-900 transition-colors"
            >
              <Zap size={20} />
            </button>
            <div className="flex flex-col">
              <p className="text-[10px] font-bold text-uanco-400 uppercase tracking-widest flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                Active Identity
              </p>
              <span className="text-xs font-medium text-uanco-900 lowercase">{session?.user?.email}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-uanco-400 hover:text-rose-600 transition-all text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-rose-50 border border-transparent hover:border-rose-100"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </header>

        <div className="flex-1 p-4 md:p-8 lg:p-12 max-w-[1600px] mx-auto w-full">
          <div className="animate-in fade-in duration-700">{renderView()}</div>
        </div>

        <footer className="py-8 px-8 border-t border-uanco-100 text-[10px] text-uanco-300 flex justify-between items-center bg-white/50">
          <p className="uppercase tracking-[0.2em]">&copy; 2024 UANCO AI PARTNER PLATFORM</p>
          <div className="flex items-center gap-4 uppercase tracking-[0.2em]">
            <span className="font-bold">SECURE PRODUCTION SESSION</span>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default App;