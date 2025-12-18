import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import KPICard from './KPICard';
import { Loader2, ArrowRight } from 'lucide-react';

const Dashboard = ({ clinicId, onNavigate }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAnalytics().then(data => {
      setAnalytics(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-uanco-300" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <h2 className="text-3xl font-serif">Overview</h2>
        <span className="text-xs font-bold text-uanco-400 uppercase tracking-widest">{clinicId}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Prescreens" value={analytics.totals.total} variant="dark" />
        <KPICard title="Safe to Book" value={analytics.totals.pass} trend="Healthy" />
        <KPICard title="Manual Review" value={analytics.totals.review} subValue="Attention" />
        <KPICard title="Drop-offs" value={analytics.totals.dropoffs} />
      </div>
      <div className="bg-white rounded-3xl p-8 border shadow-soft">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium">Performance Metrics</h3>
            <button onClick={() => onNavigate('prescreens')} className="text-xs font-bold text-uanco-400 flex items-center gap-1 hover:text-uanco-900">View Details <ArrowRight size={14} /></button>
        </div>
        <p className="text-sm text-uanco-500">System is processing patient eligibility correctly based on clinic protocols.</p>
      </div>
    </div>
  );
};
export default Dashboard;