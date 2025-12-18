
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import PreScreensView from './components/PreScreensView';
import ComplianceView from './components/ComplianceView';
import FeedbackView from './components/FeedbackView';
import TreatmentsView from './components/TreatmentsView';
import { UserMeResponse, FeatureId, ClinicData, PreScreenRecord } from './types';
import { LogOut, Loader2, Zap } from 'lucide-react';
import { MOCK_CLINICS } from './services/mockData';
import { fetchDashboardData } from './services/airtableService';

/**
 * AppPreview Component
 * 
 * Provides a fully functional dashboard environment for previewing the UI/UX 
 * without requiring Supabase configuration or actual network requests.
 * It strictly uses mock data and hardcoded demo state.
 */
const AppPreview: React.FC = () => {
  const [currentView, setCurrentView] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<ClinicData | null>(null);

  // Hardcoded Demo State
  const isDemo = true;
  const profile: UserMeResponse = {
    user: { id: "preview_user_id", email: "preview@uanco.co.uk" },
    clinic: {
      id: MOCK_CLINICS[0].id,
      name: MOCK_CLINICS[0].name,
      active: true,
      enabled_features: MOCK_CLINICS[0].features
    }
  };

  // Synchronously initialize mock data for the dashboard views
  useEffect(() => {
    const loadMockEnvironment = async () => {
      try {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30);
        
        // Fetching directly from service to ensure zero-network overhead
        const data = await fetchDashboardData({ start, end }, profile.clinic.id);
        setDashboardData(data);
      } catch (error) {
        console.error("Failed to load mock data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadMockEnvironment();
  }, []);

  const handleNavigate = (view: string) => {
    setCurrentView(view);
    setSidebarOpen(false);
    // Note: No window.history.pushState in preview to avoid interfering with platform routing
  };

  const handleUpdateRecord = (id: string, updates: Partial<PreScreenRecord>) => {
    if (!dashboardData) return;
    const updatedPreScreens = dashboardData.preScreens.map(r => 
      r.id === id ? { ...r, ...updates } : r
    );
    setDashboardData({ ...dashboardData, preScreens: updatedPreScreens });
  };

  const handleLogout = () => {
    alert("Logout functionality is disabled in Preview Mode.");
  };

  // Rendering logic for views
  const renderContent = () => {
    if (!dashboardData) return null;
    const clinicName = profile.clinic.name;

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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="mb-8 animate-in fade-in duration-700">
            <span className="text-4xl font-serif font-bold italic text-uanco-900">uanco.</span>
        </div>
        <Loader2 className="h-8 w-8 text-uanco-900 animate-spin mb-4" />
        <p className="text-uanco-400 text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse">Initialising Preview Session</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-uanco-50 font-sans text-uanco-900 selection:bg-uanco-900 selection:text-white">
      {/* Demo Status Banner */}
      <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-[0.2em] py-1 text-center z-[100] shadow-sm flex items-center justify-center gap-2">
         <Zap size={10} fill="currentColor" />
         PREVIEW MODE: AUTH & API BYPASSED
         <Zap size={10} fill="currentColor" />
      </div>

      <Sidebar 
        currentView={currentView} 
        onNavigate={handleNavigate} 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        features={profile.clinic.enabled_features as FeatureId[]}
        onOpenAdmin={() => alert("Admin Management (Preview Interface)")} 
      />

      <main className="flex-1 md:ml-64 min-h-screen flex flex-col pt-6 transition-all duration-300">
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
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    Identity: <span className="text-uanco-900 lowercase">{profile.user.email}</span>
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

        <div className="flex-1 p-4 md:p-8 lg:p-12 max-w-[1600px] mx-auto w-full">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {renderContent()}
          </div>
        </div>
        
        <footer className="py-6 px-8 border-t border-uanco-100 text-[10px] text-uanco-300 flex justify-between items-center bg-white/50">
            <p className="uppercase tracking-widest">&copy; 2024 UANCO AI PARTNER PREVIEW</p>
            <p className="uppercase tracking-widest font-bold text-amber-500/50">OFFLINE MOCK DATA</p>
        </footer>
      </main>
    </div>
  );
};

export default AppPreview;
