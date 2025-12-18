import React from 'react';
import { LayoutDashboard, Users, ShieldCheck, MessageSquarePlus, X, Sparkles, Settings2 } from 'lucide-react';
import { FeatureId } from '../types';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
  features?: FeatureId[];
  onOpenAdmin: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, isOpen, onClose, features = [], onOpenAdmin }) => {
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'prescreens', label: 'Pre-Screens', icon: Users },
    { id: 'ai-insight', label: 'AI Insight', icon: Sparkles },
    { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
    { id: 'feedback', label: 'Feedback', icon: MessageSquarePlus },
  ];

  const visibleItems = menuItems.filter(item => features.includes(item.id as FeatureId));

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-uanco-200 flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        
        <div className="h-24 flex items-center justify-between px-8 border-b border-uanco-100">
          <svg width="140" height="40" viewBox="0 0 180 50" fill="none" xmlns="http://www.w3.org/2000/svg" aria-labelledby="logoTitle">
              <title id="logoTitle">UANCO Logo</title>
              {/* Logo text set to #0f0f0f (uanco-900) */}
              <text x="0" y="32" fill="#0f0f0f" style={{ fontFamily: '"Playfair Display", serif', fontSize: '38px', fontWeight: '700', fontStyle: 'italic', letterSpacing: '-0.02em' }}>
                  uanco.
              </text>
              <text x="2" y="46" fill="#737373" style={{ fontFamily: '"Playfair Display", serif', fontSize: '9px', fontWeight: '400', letterSpacing: '0.02em' }}>
                  Smarter screening. Safer clinics
              </text>
          </svg>
          
          {/* Close button for mobile */}
          <button onClick={onClose} className="md:hidden text-uanco-400 hover:text-uanco-900">
             <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const isActive = currentView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-xl transition-all ${
                  isActive
                    ? 'bg-uanco-900 text-white shadow-soft' // Pure black active state
                    : 'text-uanco-500 hover:text-uanco-900 hover:bg-uanco-50'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-uanco-200' : 'text-uanco-400'} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer Area with Admin Toggle */}
        <div className="p-4 border-t border-uanco-100">
            <button 
                onClick={onOpenAdmin}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-uanco-400 hover:text-uanco-900 hover:bg-uanco-50 rounded-lg transition-colors mb-2"
            >
                <Settings2 size={14} />
                Feature Mgmt (Admin)
            </button>
            <div className="text-[10px] text-uanco-300 text-center">
                v1.2.0 • UANCO Analytics
            </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;