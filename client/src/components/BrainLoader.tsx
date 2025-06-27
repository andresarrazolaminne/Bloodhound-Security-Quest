import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface BrainLoaderProps {
  className?: string;
  size?: "small" | "medium" | "large";
  text?: string;
}

const BrainLoader = ({ className, size = "medium", text }: BrainLoaderProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [preloadImageUrl, setPreloadImageUrl] = useState("https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Cerebro.png");
  
  // Control de tamaño
  const sizeClasses = {
    small: "w-12 h-12",
    medium: "w-20 h-20",
    large: "w-28 h-28"
  };
  
  useEffect(() => {
    setIsVisible(true);
    
    // Load system configuration for preload image
    const loadPreloadImage = async () => {
      try {
        const response = await fetch('/api/system-config');
        if (response.ok) {
          const data = await response.json();
          const config = data.config || {};
          setPreloadImageUrl(config.preloadImageUrl || "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Cerebro.png");
        }
      } catch (error) {
        console.error('Error loading preload image configuration:', error);
      }
    };

    loadPreloadImage();
  }, []);
  
  return (
    <div className={cn(
      "flex flex-col items-center justify-center opacity-0 transition-opacity duration-300",
      isVisible && "opacity-100",
      className
    )}>
      <div className={cn(
        "relative",
        sizeClasses[size]
      )}>
        <img 
          src={preloadImageUrl} 
          alt="Cargando" 
          className={cn(
            "object-contain w-full h-full animate-float",
            "filter drop-shadow-md"
          )}
        />
        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2/3 h-1 bg-black/10 rounded-full blur-sm animate-pulse"></div>
      </div>
      
      {text && (
        <p className="mt-3 text-sm text-gray-600 animate-pulse">{text}</p>
      )}
    </div>
  );
};

export default BrainLoader;