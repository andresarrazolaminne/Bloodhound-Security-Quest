import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface BrainLoaderProps {
  className?: string;
  size?: "small" | "medium" | "large";
  text?: string;
}

const BrainLoader = ({ className, size = "medium", text }: BrainLoaderProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [preloadImageUrl, setPreloadImageUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Control de tamaño
  const sizeClasses = {
    small: "w-12 h-12",
    medium: "w-20 h-20",
    large: "w-28 h-28"
  };
  
  useEffect(() => {
    // Load system configuration for preload image FIRST, before showing anything
    const loadPreloadImage = async () => {
      try {
        const response = await fetch('/api/system-config?t=' + Date.now());
        if (response.ok) {
          const data = await response.json();
          const config = data.config || {};
          const imageUrl = config.preloadImageUrl;
          
          if (imageUrl) {
            // Preload the image before setting it
            const img = new Image();
            img.onload = () => {
              setPreloadImageUrl(imageUrl);
              setImageLoaded(true);
              setIsVisible(true);
            };
            img.onerror = () => {
              // If image fails to load, don't show any image
              setPreloadImageUrl(null);
              setImageLoaded(true);
              setIsVisible(true);
            };
            img.src = imageUrl;
          } else {
            // No image configured, don't show any image
            setPreloadImageUrl(null);
            setImageLoaded(true);
            setIsVisible(true);
          }
        } else {
          // API failed, don't show any image
          setPreloadImageUrl(null);
          setImageLoaded(true);
          setIsVisible(true);
        }
      } catch (error) {
        console.error('Error loading preload image configuration:', error);
        // Don't show any image if everything fails
        setPreloadImageUrl(null);
        setImageLoaded(true);
        setIsVisible(true);
      }
    };

    loadPreloadImage();
    
    // Listen for custom events to reload image configuration
    const handleConfigUpdate = () => {
      setImageLoaded(false);
      setIsVisible(false);
      loadPreloadImage();
    };
    
    window.addEventListener('systemConfigUpdated', handleConfigUpdate);
    
    return () => {
      window.removeEventListener('systemConfigUpdated', handleConfigUpdate);
    };
  }, []);
  
  // Don't render anything until the image is loaded
  if (!imageLoaded) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center",
        className
      )}>
        {/* Minimal fallback while loading configuration */}
        <div className={cn("relative", sizeClasses[size])}>
          <div className="w-full h-full bg-gray-200 animate-pulse rounded-lg"></div>
        </div>
      </div>
    );
  }

  // If no image is configured, don't show anything
  if (!preloadImageUrl) {
    return null;
  }

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