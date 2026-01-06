import React from "react";

type Props = {
  title: string;
  value: any;
  variant?: "dark" | "light" | "default";
  trend?: string;
  subValue?: string;

  // Optional: make the whole card clickable (used for KPI shortcuts)
  onClick?: () => void;
  ariaLabel?: string;
};

const KPICard: React.FC<Props> = ({ title, value, variant = "light", trend, subValue, onClick, ariaLabel }) => {
  const v = variant === "default" ? "light" : variant;
  const isDark = v === "dark";

  const pillClass = `text-[11px] px-3 py-1 rounded-full font-medium ${
    isDark ? "bg-white/10 text-white/80" : "bg-uanco-50 text-uanco-600"
  }`;

  const baseClasses = `relative rounded-3xl border shadow-soft p-6 flex flex-col min-h-[168px] text-left ${
    isDark ? "bg-[#111] border-[#111] text-white" : "bg-white border-uanco-100 text-uanco-900"
  }`;

  const interactiveClasses = onClick
    ? "w-full cursor-pointer hover:shadow-md hover:-translate-y-[1px] transition-all transform focus:outline-none focus-visible:ring-2 focus-visible:ring-uanco-200"
    : "";

  const Content = (
    <>
      {/* Title */}
      <p
        className={`text-[10px] font-bold uppercase tracking-[0.2em] leading-snug min-h-[28px] ${
          isDark ? "text-white/60" : "text-uanco-300"
        }`}
      >
        {title}
      </p>

      {/* Value */}
      <div
        className={`mt-auto text-5xl font-light leading-none tabular-nums ${
          isDark ? "text-white" : "text-uanco-900"
        }`}
      >
        {value}
      </div>

      {/* Pills (do NOT affect layout) */}
      {(trend || subValue) && (
        <div className="absolute bottom-6 right-6 flex items-center gap-2 pointer-events-none">
          {trend && <span className={pillClass}>{trend}</span>}
          {subValue && <span className={pillClass}>{subValue}</span>}
        </div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel || title}
        className={`${baseClasses} ${interactiveClasses}`}
      >
        {Content}
      </button>
    );
  }

  return <div className={`w-full ${baseClasses}`}>{Content}</div>;
};

export default KPICard;