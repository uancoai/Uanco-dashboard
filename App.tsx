iimport React, { useState, useEffect, useRef } from 'react';
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

const App = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [currentView, setCurrentView] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Show a clear message when data fetch fails (instead of infinite spinner)
  const [dataError, setDataError] = useState<string | null>(null);

  const hasConfig = hasValidSupabaseConfig();

  // Prevent overlapping fetches (auth events + bootstrap can race)
  const fetchingRef = useRef(false);

  // Detect if we returned from a magic link / OAuth callback
  const isAuthCallbackUrl = () => {
    const url = new URL(window.location.href);
    const hasCode = url.searchParams.has('code'); // PKCE flow
    const hasError = url.hash.includes('error=');
    const hasAccessToken = url.hash.includes('access_token=');
    const hasType = url.hash.includes('type=');
    return hasCode || hasAccessToken || hasType || hasError;
  };

  // Clean URL after exchanging session (prevents reprocessing)
  const cleanAuthFromUrl = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('code');

      if (url.hash.includes('access_token=') || url.hash.includes('error=')) {
        url.hash = '';
      }

      window.history.replaceState({}, document.title, url.toString());
    } catch {
      // no-op
    }
  };

  // Fetch clinic scope + dashboard data (only after session exists)
  const fetchProfileAndData = async (activeSession?: any) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    setLoading(true);
    setDataError(null);

    try {
      const token = activeSession?.access_token;

      // IMPORTANT: pass token explicitly to avoid refresh race
      const me = await api.getMe(token);
      setProfile(me);

      const fullData = await api.getFullDashboardData(me.clinic.id, token);
      setDashboardData(fullData);
    } catch (e: any) {
      console.error('[fetchProfileAndData] failed', e);

      setProfile(null);
      setDashboardData(null);

      const msg =
        e?.message ||
        (typeof e === 'string' ? e : 'Failed to load clinic data. Check Netlify functions + auth token.');
      setDataError(msg);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (!hasConfig) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const s = data.session ?? null;

        if (cancelled) return;

        setSession(s);

        if (s) {
          if (isAuthCallbackUrl()) cleanAuthFromUrl();
          await fetchProfileAndData(s);
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error('[bootstrap] getSession failed', e);
        setLoading(false);
      }
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (cancelled) return;

      console.log('[auth change]', _event);

      setSession(newSession);

      if (newSession) {
        if (isAuthCallbackUrl()) cleanAuthFromUrl();
        await fetchProfileAndData(newSession);
      } else {
        setProfile(null);
        setDashboardData(null);
        setDataError(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const updatedPreScreens = dashboardData.preScreens.map((r: any) =>
      r.id === id ? { ...r, ...updates } : r
    );
    setDashboardData({ ...dashboardData, preScreens: updatedPreScreens });
  };

  // Only show the full-screen "Establishing Connection" while we DON'T yet know if a session exists.
  if (hasConfig && loading && session === null) {
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

  // Not logged in -> show Auth screen (and config warning if missing)
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
                  Supabase keys are not detected in this environment. Add Netlify env vars and redeploy.
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
    // Logged in but data isn't loaded yet
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
                      onClick={async () => fetchProfileAndData(session)}
                      className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl bg-uanco-900 text-white hover:opacity-90"
                    >
                      <RefreshCw size={14} /> Retry
                    </button>

                    <button
                      onClick={() => window.location.reload()}
                      className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl border border-uanco-100 text-uanco-600 hover:bg-uanco-50"
                    >
                      Hard refresh
                    </button>
                  </div>

                  <p className="mt-4 text-[10px] text-uanco-300 uppercase tracking-widest">
                    Backend must return 200 with Bearer token: /.netlify/functions/me and /.netlify/functions/dashboard
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