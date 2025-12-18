
import React from 'react';
import { AlertTriangle } from 'lucide-react';

// Added onUpdateRecord prop to fix type mismatch errors
const ComplianceView = ({ records, failReasons, onUpdateRecord }: { records: any, failReasons: any, onUpdateRecord?: any }) => {
    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-serif">Compliance & Safety</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 border rounded-3xl shadow-soft">
                    <h3 className="font-bold mb-4">Top Contraindications</h3>
                    {failReasons.map(f => (
                        <div key={f.reason} className="mb-3">
                            <div className="flex justify-between text-xs mb-1"><span>{f.reason}</span><span>{f.count}</span></div>
                            <div className="bg-uanco-100 h-1.5 rounded-full overflow-hidden"><div className="bg-rose-500 h-full" style={{width: `${f.count * 10}%`}}></div></div>
                        </div>
                    ))}
                </div>
                <div className="lg:col-span-2 bg-white border rounded-3xl p-6 shadow-soft">
                    <h3 className="font-bold mb-4">Flagged for Review</h3>
                    <p className="text-uanco-400 text-sm">All medical flags are summarized for practitioner review.</p>
                </div>
            </div>
        </div>
    );
};
export default ComplianceView;
