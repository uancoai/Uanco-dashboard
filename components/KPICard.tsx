import React, { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

type Props = {
  title: string;
  value: any;
  variant?: "dark" | "light";
  trend?: string;
  subValue?: string;

  // ✅ NEW: optional tooltip text
  info?: string;
};

const KPICard: React.FC<Props> = ({ title, value, variant = "light", trend, subValue, info }) => {
  const isDark = variant === "dark";
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close tooltip if you tap/click anywhere outside the card
  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current) return;
      const target = e.target as Node;
      if (!wrapRef.current.contains(target)) setOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown as any);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className={`relative rounded-3xl border shadow-soft p-6 overflow-visible ${
        isDark ? "bg-[#111] border-[#111] text-white" : "bg-white border-uanco-100 text-uanco-900"
      }`}
      // hover support (desktop)
      onMouseEnter={() => info && setOpen(true)}
      onMouseLeave={() => info && setOpen(false)}
    >
      {/* Info icon (top-right) */}
      {info && (
        <div className="absolute top-4 right-4 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors border ${
              isDark
                ? "bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                : "bg-uanco-50 border-uanco-100 text-uanco-400 hover:text-uanco-900 hover:bg-uanco-100"
            }`}
            aria-label={`Info: ${title}`}
          >
            <Info size={14} />
          </button>

          {/* Tooltip */}
          {open && (
            <div
              className={`absolute right-0 mt-2 w-[260px] rounded-2xl px-4 py-3 text-[11px] leading-relaxed shadow-2xl border ${
                isDark
                  ? "bg-[#0b0b0b] text-white/90 border-white/10"
                  : "bg-white text-uanco-700 border-uanco-100"
              }`}
            >
              <p className="font-medium">{info}</p>
            </div>
          )}
        </div>
      )}

      {/* Title */}
      <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isDark ? "text-white/60" : "text-uanco-300"}`}>
        {title}
      </p>

      {/* Value + tags */}
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className={`text-5xl font-light ${isDark ? "text-white" : "text-uanco-900"}`}>{value}</div>

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
