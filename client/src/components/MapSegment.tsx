import { useState } from "react";
import { cn } from "@/lib/utils";

interface MapSegmentProps {
  id: number;
  imageUrl: string;
  altText: string;
  unlocked: boolean;
  className?: string;
}

const MapSegment = ({ id, imageUrl, altText, unlocked, className }: MapSegmentProps) => {
  // Estado para manejar errores de carga de imágenes
  const [imageError, setImageError] = useState(false);
  
  const handleImageError = () => {
    console.log(`Imagen segmento ${id} falló al cargar: ${imageUrl}`);
    setImageError(true);
  };

  // Imagen de respaldo por si falla la carga
  const fallbackImageUrl = "https://images.unsplash.com/photo-1509773896068-7fd415d91e2e?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80";
  
  return (
    <div 
      className={cn(
        "segment rounded-lg overflow-hidden cursor-pointer transition-all duration-300 transform hover:scale-105", 
        className
      )} 
      data-segment-id={id}
    >
      <div className="relative aspect-square bg-gray-100">
        <img 
          src={imageError ? fallbackImageUrl : imageUrl}
          alt={altText}
          onError={handleImageError}
          className={cn(
            "w-full h-full object-cover", 
            !unlocked && "grayscale"
          )}
        />
        {!unlocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 transition-opacity">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-8 w-8 text-white" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapSegment;
