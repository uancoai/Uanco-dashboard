
import React from 'react';

// Added missing questions prop to fix type mismatch errors
const TreatmentsView = ({ stats, questions }: { stats: any, questions?: any }) => (
    <div className="space-y-8">
        <h2 className="text-3xl font-serif">AI Insight</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.map(s => (
                <div key={s.name} className="bg-white p-6 border rounded-3xl shadow-soft">
                    <h3 className="font-bold mb-4">{s.name}</h3>
                    <div className="flex justify-between text-sm mb-2"><span>Demand</span><span>{s.count}</span></div>
                    <div className="flex justify-between text-sm"><span>Pass Rate</span><span>{s.passRate}%</span></div>
                </div>
            ))}
        </div>
    </div>
);
export default TreatmentsView;
