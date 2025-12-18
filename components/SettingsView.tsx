import React from 'react';

const SettingsView: React.FC = () => {
  return (
    <div className="max-w-2xl">
       <h2 className="text-3xl font-serif text-slate-900 tracking-tight mb-2">Settings</h2>
       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">System Configuration</p>

       <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-6">
            <div className="pb-6 border-b border-slate-50">
                <h3 className="text-lg font-medium text-slate-900 mb-2">Clinic Profile</h3>
                <p className="text-sm text-slate-500 mb-4">Update your clinic details used in AI responses.</p>
                <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Clinic Name" className="p-3 bg-slate-50 rounded-lg text-sm border-none focus:ring-1 ring-slate-200" defaultValue="UANCO Esthetics" />
                    <input type="email" placeholder="Admin Email" className="p-3 bg-slate-50 rounded-lg text-sm border-none focus:ring-1 ring-slate-200" defaultValue="admin@uanco.co.uk" />
                </div>
            </div>

            <div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">AI Sensitivity</h3>
                <p className="text-sm text-slate-500 mb-4">Adjust how strict the pre-screening AI should be.</p>
                <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-slate-400">STRICT</span>
                    <input type="range" className="flex-1 accent-slate-900" />
                    <span className="text-xs font-bold text-slate-400">PERMISSIVE</span>
                </div>
            </div>
            
            <div className="pt-4 flex justify-end">
                <button className="bg-slate-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-black transition-colors">Save Changes</button>
            </div>
       </div>
    </div>
  );
};

export default SettingsView;