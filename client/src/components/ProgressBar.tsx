import { cn } from "@/lib/utils";
import { Check, X, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface ProgressBarProps {
  progress: number;
  total: number;
  className?: string;
  progressTextColor?: string;
  /** Estadísticas de trivia en la misma franja que el progreso (vista jugador). */
  quizCorrect?: number;
  quizWrong?: number;
  quizBonus?: number;
}

const ProgressBar = ({
  progress,
  total,
  className,
  progressTextColor = "#1e293b",
  quizCorrect = 0,
  quizWrong = 0,
  quizBonus = 0,
}: ProgressBarProps) => {
  const safeTotal = Math.max(total, 1);
  const percentage = Math.min(Math.round((progress / safeTotal) * 100), 100);
  const [animated, setAnimated] = useState(false);

  const getColor = () => {
    if (percentage < 30) return "bg-gradient-to-r from-rose-500 via-orange-500 to-amber-400";
    if (percentage < 70) return "bg-gradient-to-r from-amber-400 via-yellow-400 to-lime-400";
    return "bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500";
  };

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(timer);
  }, []);

  /** Color de marca desde admin (antes se usaba para texto sobre el fondo del mapa). Aquí el HUD es claro: el acento va al borde y brillo de la barra, no al texto — si no, #fff sobre blanco es invisible. */
  const accent =
    progressTextColor && progressTextColor.trim() !== "" ? progressTextColor.trim() : "#d97706";

  return (
    <div
      className={cn(
        "mb-3 rounded-2xl border border-white/60 bg-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.1)] backdrop-blur-md px-3 py-2.5 ring-1 ring-amber-500/15 sm:px-4 sm:py-3",
        className
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: accent, borderLeftStyle: "solid" }}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
            Progreso
          </span>
          <span className="tabular-nums text-sm font-bold text-slate-900 sm:text-base">
            {progress}/{safeTotal}
          </span>
          <span className="rounded-full bg-slate-900/8 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-800 ring-1 ring-slate-900/12">
            {percentage}%
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 tabular-nums shadow-sm sm:text-xs"
            title="Respuestas correctas"
          >
            <Check className="h-3 w-3 shrink-0 text-emerald-600" strokeWidth={2.5} />
            {quizCorrect}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-900 tabular-nums shadow-sm sm:text-xs"
            title="Respuestas incorrectas"
          >
            <X className="h-3 w-3 shrink-0 text-rose-600" strokeWidth={2.5} />
            {quizWrong}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full border border-indigo-400/30 bg-indigo-500/12 px-2 py-0.5 text-[11px] font-semibold text-indigo-950 tabular-nums shadow-sm sm:text-xs"
            title="Puntos bonus por trivia"
          >
            <Sparkles className="h-3 w-3 shrink-0 text-indigo-600" />
            +{quizBonus}
          </span>
        </div>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/90 shadow-inner ring-1 ring-slate-300/40 sm:h-3">
        <div
          className={cn(
            "relative h-full rounded-full transition-[width] duration-700 ease-out",
            getColor()
          )}
          style={{
            width: animated ? `${percentage}%` : "0%",
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 0 14px ${accent}40`,
          }}
        >
          {percentage > 0 && (
            <div
              className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/35 to-transparent"
              aria-hidden
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
