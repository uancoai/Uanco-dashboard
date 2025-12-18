
import React from 'react';

// Added interface to ensure optional props are correctly typed for TypeScript inference
interface KPICardProps {
  title: any;
  value: any;
  subValue?: any;
  trend?: any;
  variant?: string;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, subValue, trend, variant = "default" }) => {
  const isDark = variant === "dark";
  return (
    <div className={`p-5 rounded-2xl border shadow-sm h-32 flex flex-col justify-between ${isDark ? 'bg-uanco-900 text-white border-uanco-900' : 'bg-white text-uanco-900 border-uanco-100'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-uanco-400' : 'text-uanco-400'}`}>{title}</p>
      <div className="flex items-end justify-between mt-auto">
        <h3 className="text-4xl font-light">{value}</h3>
        {trend && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10' : 'bg-uanco-100'}`}>{trend}</span>}
      </div>
    </div>
  );
};
export default KPICard;
