import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { AnalyticsResponse, PreScreenRecord, Eligibility } from '../types';
import KPICard from './KPICard';
import { Sparkles, Loader2, ArrowRight } from 'lucide-react';

interface DashboardProps {
  clinicId?: string;
  onNavigate: (view: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ clinicId, onNavigate }) => {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [prescreens, setPrescreens] = useState<PreScreenRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [aData, pData] = await Promise.all([
          api.getAnalytics({ range: '7d' }),
          api.getPrescreens({ limit: 5 })
        ]);
        setAnalytics(aData);
        setPrescreens(pData.rows);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-uanco-300" size={32} />
      </div>
    );
  }

  const totals = analytics ? analytics.totals : { total: 0, pass: 0, review: 0, dropoffs: 0 };
  const firstTreatment = (prescreens.length > 0) ? prescreens[0].treatment_selected : 'Lip Fillers';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-serif text-uanco-900 tracking-tight">Overview</h2>
            <span className="bg-uanco-100 text-uanco-500 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-widest border border-uanco-200">
              {clinicId || 'Clinic'}
            </span>
          </div>
          <p className="text-uanco-400 text-xs font-bold uppercase tracking-widest mt-2">7-Day Performance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Prescreens" value={totals.total} variant="dark" />
        <KPICard title="Safe to Book" value={totals.pass} trend="62% Conversion" />
        <KPICard title="Manual Review" value={totals.review} subValue="Action Required" />
        <KPICard title="Drop-offs" value={totals.dropoffs} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-uanco-100 shadow-soft">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-medium text-uanco-900">Recent Activity</h3>
            <button onClick={() => onNavigate('prescreens')} className="text-xs font-bold text-uanco-400 hover:text-uanco-900 uppercase tracking-widest transition-colors flex items-center gap-1">
              View All <ArrowRight size={14} />
            </button>
          </div>

          <div className="space-y-6">
            {prescreens.map((record) => (
              <div key={record.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-uanco-50 border border-uanco-100 flex items-center justify-center text-[10px] font-bold text-uanco-700">
                    {record.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-uanco-900">{record.name}</h4>
                    <p className="text-xs text-uanco-400 font-medium">{record.treatment_selected}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                  record.eligibility === Eligibility.PASS ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                  record.eligibility === Eligibility.REVIEW ? 'bg-amber-50 text-amber-700 border-amber-100' :
                  'bg-rose-50 text-rose-700 border-rose-100'
                }`}>
                  {record.eligibility}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-uanco-900 rounded-3xl p-8 text-white relative overflow-hidden flex flex-col justify-between h-80">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="relative z-10">
            <div className="bg-white/10 p-2 rounded-lg w-fit mb-6">
              <Sparkles size={18} />
            </div>
            <h3 className="text-xl font-medium leading-normal">
              "{firstTreatment}" inquiries are trending up this week.
            </h3>
            <p className="text-sm text-uanco-400 mt-4 leading-relaxed">
              Recommendation: Increase ad spend on Instagram between 6pm-9pm for maximum patient engagement.
            </p>
          </div>
          <button onClick={() => onNavigate('ai-insight')} className="text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white transition-colors underline underline-offset-4">
            View Market Intelligence
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;