import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import KPICard from './KPICard';
import { Loader2, ArrowRight } from 'lucide-react';

type Props = {
  clinicId?: string;      // Airtable rec... id
  clinicName?: string;    // Pretty name for display
  onNavigate: (view: string) => void;
};

const Dashboard: React.FC<Props> = ({ clinicId, clinicName, onNavigate }) => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setErr(null);

      try {
        // clinicId is optional now (backend can resolve it),
        // but we still pass it if we have it.
        const data = await api.getAnalytics({ range: '30d', clinicId });
        if (!cancelled) setAnalytics(data);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Failed to load analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="animate-spin text-uanco-300" />
      </div>
    );
  }

  if (err) {
    return (
      <div className="bg-white rounded-3xl p-8 border shadow-soft">
        <p className="text-sm text-rose-600 font-medium">Dashboard analytics failed</p>
        <p className="text-xs text-uanco-500 mt-2 break-words">{err}</p>
      </div>
    );
  }

  const totals = analytics?.totals || { total: 0, pass: 0, review: 0, dropoffs: 0 };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <h2 className="text-3xl font-serif">Overview</h2>
        <span className="text-xs font-bold text-uanco-400 uppercase tracking-widest">
          {clinicName || clinicId || 'Clinic'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Prescreens" value={totals.total} variant="dark" />
        <KPICard title="Safe to Book" value={totals.pass} trend="Healthy" />
        <KPICard title="Manual Review" value={totals.review} subValue="Attention" />
        <KPICard title="Drop-offs" value={totals.dropoffs} />
      </div>

      <div className="bg-white rounded-3xl p-8 border shadow-soft">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium">Performance Metrics</h3>
          <button
            onClick={() => onNavigate('prescreens')}
            className="text-xs font-bold text-uanco-400 flex items-center gap-1 hover:text-uanco-900"
          >
            View Details <ArrowRight size={14} />
          </button>
        </div>
        <p className="text-sm text-uanco-500">
          System is processing patient eligibility correctly based on clinic protocols.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;