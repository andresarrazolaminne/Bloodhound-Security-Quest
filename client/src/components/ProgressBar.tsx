import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface ProgressBarProps {
  progress: number;
  total: number;
  className?: string;
}

const ProgressBar = ({ progress, total, className }: ProgressBarProps) => {
  const percentage = Math.min(Math.round((progress / total) * 100), 100);
  const [animated, setAnimated] = useState(false);
  
  // Determinar el color basado en el progreso
  const getColor = () => {
    if (percentage < 30) return "bg-gradient-to-r from-red-500 to-orange-500";
    if (percentage < 70) return "bg-gradient-to-r from-orange-400 to-amber-400";
    return "bg-gradient-to-r from-green-500 to-emerald-500";
  };
  
  // Animar cuando el componente se monta
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimated(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={cn("mb-6", className)}>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-medium text-gray-800">Tu Progreso</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {progress}/{total} completados
          </span>
          <div className="bg-gray-100 rounded-full px-2 py-0.5 text-xs font-bold text-gray-800">
            {percentage}%
          </div>
        </div>
      </div>
      <div className="h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
        <div 
          className={`h-full ${getColor()} rounded-full transition-all duration-1000 ease-out relative`}
          style={{ 
            width: animated ? `${percentage}%` : '0%',
            boxShadow: "0 0 8px rgba(0, 0, 0, 0.1) inset" 
          }}
        >
          {percentage > 0 && (
            <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" 
                 style={{animationDuration: "3s"}}></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
