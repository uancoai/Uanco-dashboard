import React, { useState, useEffect } from 'react';
import { supabase, hasValidSupabaseConfig } from './lib/supabase';
import { api } from './lib/api';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import PreScreensView from './components/PreScreensView';
import ComplianceView from './components/ComplianceView';
import FeedbackView from './components/FeedbackView';
import TreatmentsView from './components/TreatmentsView';
import Auth from './components/Auth';
import { LogOut, Loader2, Zap, AlertCircle } from 'lucide-react';

const App = () => {
  const [session, setSession] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [profile, setProfile] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [currentView, setCurrentView] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const hasConfig = hasValidSupabaseConfig();

  // 1. Fail-safe: If loading > 2s, force demo mode and show UI
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading && !profile) {
        setLoadingTimedOut(true);
        handleDemoLogin();
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [loading, profile]);

  useEffect(() => {
    const initApp = async () => {
      // 3. Demo mode must not depend on Supabase config
      if (!hasConfig) {
        handleDemoLogin();
        return;
      }

      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          setSession(currentSession);
          setIsDemo(false);
          await fetchProfile();
        } else {
          setLoading(false);
        }
      } catch (e) {
        handleDemoLogin();
      }
    };

    initApp();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (newSession) {
        setSession(newSession);
        setIsDemo(false);
        fetchProfile();
      } else if (!isDemo) {
        setSession(null);
        setProfile(null);
        setDashboardData(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await api.getMe();
      setProfile(data);
      const fullData = await api.getFullDashboardData(data.clinic.id);
      setDashboardData(fullData);
    } catch (e) {
      if (!isDemo) handleDemoLogin();
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setIsDemo(true);
    setSession({ user: { email: 'demo@uanco.co.uk' } });
    
    const loadMock = async () => {
        try {
            const data = await api.getMe();
            setProfile(data);
            const fullData = await api.getFullDashboardData(data.clinic.id);
            setDashboardData(fullData);
        } catch(e) {
            console.error("Mock load failed", e);
        } finally {
            setLoading(false);
        }
    };
    loadMock();
  };

  const handleLogout = () => {
    if (isDemo) {
      setIsDemo(false);
      setSession(null);
      setProfile(null);
      setDashboardData(null);
      setLoading(false);
    } else {
      supabase.auth.signOut();
    }
  };

  const handleNavigate = (view) => {
    setCurrentView(view);
    setSidebarOpen(false);
    window.history.pushState({}, '', `/${view}`);
  };

  const handleUpdateRecord = (id, updates) => {
    if (!dashboardData) return;
    const updatedPreScreens = dashboardData.preScreens.map(r => r.id === id ? { ...r, ...updates } : r);
    setDashboardData({ ...dashboardData, preScreens: updatedPreScreens });
  };

  // Loading screen logic
  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6 text-center">
        <div className="mb-12">
            <span className="text-5xl font-serif font-bold italic text-uanco-900 block mb-2">uanco.</span>
            <div className="h-1 w-12 bg-uanco-900 mx-auto rounded-full"></div>
        </div>
        <div className="space-y-6">
            <Loader2 className="h-12 w-12 text-uanco-900 animate-spin mx-auto opacity-50" />
            <p className="text-uanco-400 text-[10px] font-bold uppercase tracking-[0.3em] animate-pulse">Establishing Connection</p>
        </div>
      </div>
    );
  }

  if (!session && !isDemo) {
    return <Auth onDemoLogin={handleDemoLogin} />;
  }

  const renderView = () => {
    if (!dashboardData) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-uanco-200" size={32} /></div>;
    const clinicName = profile ? profile.clinic.name : 'Clinic';
    switch (currentView) {
      case 'overview': return <Dashboard clinicId={clinicName} onNavigate={handleNavigate} />;
      case 'prescreens': return <PreScreensView records={dashboardData.preScreens} dropOffs={dashboardData.dropOffs} onUpdateRecord={handleUpdateRecord} />;
      case 'ai-insight': return <TreatmentsView stats={dashboardData.metrics.treatmentStats} questions={dashboardData.questions} />;
      case 'compliance': return <ComplianceView records={dashboardData.preScreens} failReasons={dashboardData.metrics.failReasons} onUpdateRecord={handleUpdateRecord} />;
      case 'feedback': return <FeedbackView />;
      default: return <Dashboard clinicId={clinicName} onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-uanco-50 font-sans text-uanco-900 selection:bg-uanco-900 selection:text-white">
      {/* 4. Demo Mode Banner */}
      {isDemo && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-[0.2em] py-1 text-center z-[100] shadow-md flex items-center justify-center gap-2">
           <Zap size={10} fill="currentColor" />
           DEMO MODE — mock data
           <Zap size={10} fill="currentColor" />
        </div>
      )}

      <Sidebar 
        currentView={currentView} 
        onNavigate={handleNavigate} 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        features={(profile && profile.clinic.enabled_features) || []}
        onOpenAdmin={() => {}} 
      />

      <main className={`flex-1 md:ml-64 min-h-screen flex flex-col transition-all duration-300 ${isDemo ? 'pt-6' : ''}`}>
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-uanco-100 flex items-center justify-between px-6 md:px-8 sticky top-0 z-20">
          <div className="flex items-center gap-4">
             <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-uanco-400 hover:text-uanco-900 transition-colors">
                <Zap size={20} />
             </button>
             <div className="flex flex-col">
                <p className="text-[10px] font-bold text-uanco-400 uppercase tracking-widest flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${isDemo ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`}></span>
                    Active Identity
                </p>
                <span className="text-xs font-medium text-uanco-900 lowercase">{session?.user?.email || 'guest-session'}</span>
             </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-uanco-400 hover:text-rose-600 transition-all text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-rose-50 border border-transparent hover:border-rose-100">
            <LogOut size={14} /> Sign Out
          </button>
        </header>

        <div className="flex-1 p-4 md:p-8 lg:p-12 max-w-[1600px] mx-auto w-full">
          {loadingTimedOut && (
            <div className="mb-8 bg-amber-50 border border-amber-200 p-5 rounded-3xl flex items-center gap-4 text-amber-800 text-xs font-medium shadow-sm">
                <div className="h-8 w-8 bg-amber-200/50 rounded-full flex items-center justify-center shrink-0">
                    <AlertCircle size={18} className="text-amber-700" />
                </div>
                <div>
                    <p className="font-bold uppercase tracking-wider mb-0.5">Connection Latency Detected</p>
                    <p className="opacity-70">The system encountered a delay. Showing demo data to maintain access.</p>
                </div>
            </div>
          )}
          <div className="animate-in fade-in duration-700">
            {renderView()}
          </div>
        </div>
        
        <footer className="py-8 px-8 border-t border-uanco-100 text-[10px] text-uanco-300 flex justify-between items-center bg-white/50">
            <p className="uppercase tracking-[0.2em]">&copy; 2024 UANCO AI PARTNER PLATFORM</p>
            <div className="flex items-center gap-4 uppercase tracking-[0.2em]">
                <span className="font-bold">{isDemo ? 'OFFLINE PREVIEW' : 'SECURE PRODUCTION SESSION'}</span>
            </div>
        </footer>
      </main>
    </div>
  );
};

export default App;