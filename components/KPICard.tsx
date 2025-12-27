import React from "react";

type Props = {
  title: string;
  value: any;
  variant?: "dark" | "light";
  trend?: string;
  subValue?: string;
};

const KPICard: React.FC<Props> = ({ title, value, variant = "light", trend, subValue }) => {
  const isDark = variant === "dark";

  return (
    <div
      className={`rounded-3xl border shadow-soft p-6 ${
        isDark ? "bg-[#111] border-[#111] text-white" : "bg-white border-uanco-100 text-uanco-900"
      }`}
    >
      <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isDark ? "text-white/60" : "text-uanco-300"}`}>
        {title}
      </p>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div className={`text-5xl font-light leading-none ${isDark ? "text-white" : "text-uanco-900"}`}>
          {value}
        </div>

        {(trend || subValue) && (
          <div className="flex items-center gap-2">
            {trend && (
              <span
                className={`text-[11px] px-3 py-1 rounded-full font-medium ${
                  isDark ? "bg-white/10 text-white/80" : "bg-uanco-50 text-uanco-600"
                }`}
              >
                {trend}
              </span>
            )}
            {subValue && (
              <span
                className={`text-[11px] px-3 py-1 rounded-full font-medium ${
                  isDark ? "bg-white/10 text-white/80" : "bg-uanco-50 text-uanco-600"
                }`}
              >
                {subValue}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default KPICard;