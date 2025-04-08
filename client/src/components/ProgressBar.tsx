import { cn } from "@/lib/utils";

interface ProgressBarProps {
  progress: number;
  total: number;
  className?: string;
}

const ProgressBar = ({ progress, total, className }: ProgressBarProps) => {
  const percentage = Math.min(Math.round((progress / total) * 100), 100);

  return (
    <div className={cn("mb-6", className)}>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-medium text-gray-800">Tu Progreso</h2>
        <span className="text-sm font-medium text-gray-600">
          {progress}/{total} completados
        </span>
      </div>
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-green-500 rounded-full transition-all duration-500" 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
