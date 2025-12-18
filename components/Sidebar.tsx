
import React from 'react';
import { LayoutDashboard, Users, ShieldCheck, MessageSquarePlus, X, Sparkles } from 'lucide-react';

// Added interface for explicit prop typing and to include onOpenAdmin
interface SidebarProps {
  currentView: any;
  onNavigate: any;
  isOpen: any;
  onClose: any;
  features?: any[];
  onOpenAdmin: any;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, isOpen, onClose, features = [], onOpenAdmin }) => {
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'prescreens', label: 'Pre-Screens', icon: Users },
    { id: 'ai-insight', label: 'AI Insight', icon: Sparkles },
    { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
    { id: 'feedback', label: 'Feedback', icon: MessageSquarePlus },
  ];

  const visibleItems = menuItems.filter(item => features.includes(item.id));

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={onClose} />}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-uanco-200 flex flex-col transform transition-transform md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-24 flex items-center justify-between px-8 border-b">
          <span className="text-4xl font-serif font-bold italic text-uanco-900">uanco.</span>
          <button onClick={onClose} className="md:hidden text-uanco-400"><X size={20} /></button>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {visibleItems.map((item) => {
            const isActive = currentView === item.id;
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => onNavigate(item.id)} className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-xl transition-all ${isActive ? 'bg-uanco-900 text-white shadow-soft' : 'text-uanco-500 hover:bg-uanco-50'}`}>
                <Icon size={18} /> {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
};
export default Sidebar;
