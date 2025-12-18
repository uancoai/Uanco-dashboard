import React, { useState, useEffect } from 'react';
import { supabase, hasValidSupabaseConfig } from './lib/supabase';
import { api } from './lib/api';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import PreScreensView from './components/PreScreensView';
import ComplianceView from './components/ComplianceView';
import FeedbackView from './components/FeedbackView';
import TreatmentsView from './components/TreatmentsView';
// Fix: Remove .tsx extension to prevent loading raw TS files in some environments
import Auth from './components/Auth';
import { UserMeResponse, FeatureId, ClinicData, PreScreenRecord, Eligibility } from './types';
import { LogOut, Loader2, ShieldAlert, Zap } from 'lucide-react';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserMeResponse | null>(null);
  const [dashboardData, setDashboardData] = useState<ClinicData | null>(null);
  const [currentView, setCurrentView] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Safety Timeout: Prevent the app from hanging forever in a loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.warn("Loading timeout reached. Forcing UI render.");
        setLoading(false);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Basic Router Fallback: handle direct URL access
  useEffect(() => {
    const path = window.location.pathname.replace('/', '');
    const validViews = ['overview', 'prescreens', 'ai-insight', 'compliance', 'feedback', 'login'];
    if (path && validViews.includes(path)) {
      if (path === 'login' && !isDemo && !session) {
        // Stay on login
      } else {
        setCurrentView(path === 'login' ? 'overview' : path);
      }
    }
  }, [isDemo, session]);

  useEffect(() => {
    const initApp = async () => {
      if (!hasValidSupabaseConfig()) {
        console.warn("Supabase keys missing. Entering Auto-Demo mode.");
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
        console.error("Session initialization failed, falling back to demo.");
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
      console.error("Data fetch failed:", e);
    } finally {
      // Always ensure loading is set to false to prevent stuck screens
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setIsDemo(true);
    setSession({ user: { email: 'demo@uanco.co.uk' } });
    fetchProfile();
  };

  const handleLogout = () => {
    if (isDemo) {
      setIsDemo(false);
      setSession(null);
      setProfile(null);
      setDashboardData(null);
      window.location.hash = '';
    } else {
      supabase.auth.signOut();
    }
  };

  const handleNavigate = (view: string) => {
    setCurrentView(view);
    setSidebarOpen(false);
    window.history.pushState({}, '', `/${view}`);
  };

  const handleUpdateRecord = (id: string, updates: Partial<PreScreenRecord>) => {
    if (!dashboardData) return;
    const updatedPreScreens = dashboardData.preScreens.map(r => r.id === id ? { ...r, ...updates } : r);
    setDashboardData({ ...dashboardData, preScreens: updatedPreScreens });
  };

  // Render Logic
  if (loading && !profile && !dashboardData) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="mb-8">
            <span className="text-4xl font-serif font-bold italic text-uanco-900">uanco.</span>
        </div>
        <Loader2 className="h-8 w-8 text-uanco-900 animate-spin mb-4" />
        <p className="text-uanco-400 text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse">Initialising Dashboard</p>
      </div>
    );
  }

  if (!session && !isDemo) {
    return <Auth onDemoLogin={handleDemoLogin} />;
  }

  if (profile && !profile.clinic.active) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="h-20 w-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert size={40} />
          </div>
          <h2 className="text-3xl font-serif text-uanco-900">Account Inactive</h2>
          <p className="text-uanco-500 leading-relaxed">
            Your clinic account is currently suspended or inactive. Please contact <span className="font-bold">partners@uanco.co.uk</span> to restore access.
          </p>
          <button onClick={handleLogout} className="text-uanco-900 font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 mx-auto mt-8 hover:opacity-70 transition-opacity">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  const renderView = () => {
    const features = profile ? profile.clinic.enabled_features : [];
    
    if (currentView !== 'overview' && !features.includes(currentView)) {
      return (
        <div className="h-[60vh] flex flex-col items-center justify-center text-center">
          <ShieldAlert size={48} className="text-uanco-200 mb-4" />
          <h2 className="text-xl font-serif text-uanco-900">Feature Disabled</h2>
          <p className="text-uanco-400 text-sm mt-2">Your current plan does not include the {currentView} module.</p>
          <button onClick={() => handleNavigate('overview')} className="mt-6 text-uanco-900 font-bold text-xs uppercase tracking-widest underline">Return to Overview</button>
        </div>
      );
    }

    const clinicName = profile ? profile.clinic.name : 'Clinic';

    if (!dashboardData) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="animate-spin text-uanco-200 mx-auto mb-4" size={32} />
                    <p className="text-uanco-400 text-xs font-bold uppercase tracking-widest">Loading Clinic Intelligence...</p>
                </div>
            </div>
        );
    }

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
        return (
          <TreatmentsView 
            stats={dashboardData.metrics.treatmentStats} 
            questions={dashboardData.questions} 
          />
        );
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
      {/* Demo Mode Global Banner */}
      {isDemo && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-[0.2em] py-1 text-center z-[100] shadow-sm flex items-center justify-center gap-2">
           <Zap size={10} fill="currentColor" />
           DEMO MODE (mock data)
           <Zap size={10} fill="currentColor" />
        </div>
      )}

      <Sidebar 
        currentView={currentView} 
        onNavigate={handleNavigate} 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        features={((profile && profile.clinic.enabled_features) || []) as FeatureId[]}
        onOpenAdmin={() => {}} 
      />

      <main className={`flex-1 md:ml-64 min-h-screen flex flex-col ${isDemo ? 'pt-6' : ''}`}>
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-uanco-100 flex items-center justify-between px-6 md:px-8 sticky top-0 z-20">
          <div className="flex items-center gap-3">
             <button 
                onClick={() => setSidebarOpen(true)} 
                className="md:hidden p-2 -ml-2 text-uanco-400 hover:text-uanco-900 transition-colors"
                aria-label="Open Menu"
             >
                <Zap size={20} />
             </button>
             <div>
                <p className="text-[10px] font-bold text-uanco-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Active: <span className="text-uanco-900 lowercase">{session?.user?.email || 'guest'}</span>
                </p>
             </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-2 text-uanco-400 hover:text-rose-600 transition-all text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg hover:bg-rose-50"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </header>

        <div className="flex-1 p-4 md:p-8 lg:p-12 max-w-[1600px] mx-auto w-full transition-all duration-300">
          {renderView()}
        </div>
        
        <footer className="py-6 px-8 border-t border-uanco-100 text-[10px] text-uanco-300 flex justify-between items-center bg-white/50">
            <p className="uppercase tracking-widest">&copy; 2024 UANCO AI PARTNER PORTAL</p>
            <p className="uppercase tracking-widest">ENCRYPTED & SECURE</p>
        </footer>
      </main>
    </div>
  );
};

export default App;