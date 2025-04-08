import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { ExternalLink } from "lucide-react";
import { MapSegmentAsset } from "@shared/schema";

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
  const [asset, setAsset] = useState<MapSegmentAsset | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Cargar el asset del segmento independientemente de si está desbloqueado o no
  useEffect(() => {
    loadSegmentAsset();
  }, [id]);
  
  const loadSegmentAsset = async () => {
    try {
      setLoading(true);
      const response = await apiRequest("GET", `/api/admin/map-assets/${id}`);
      const data = await response.json();
      
      // Si el asset es null, significa que no hay configuración para este segmento
      if (data.asset) {
        setAsset(data.asset);
      } else {
        console.log(`No hay configuración para el segmento ${id}`);
      }
    } catch (error) {
      // Error silencioso - simplemente usará la imagen por defecto
      console.log(`Error al cargar el asset del segmento ${id}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleImageError = () => {
    console.log(`Imagen segmento ${id} falló al cargar: ${imageUrl}`);
    setImageError(true);
  };
  
  const handleSegmentClick = () => {
    if (unlocked && asset?.redirectUrl) {
      window.open(asset.redirectUrl, "_blank", "noopener,noreferrer");
    }
  };

  // Imagen de respaldo por si falla la carga
  const fallbackImageUrl = "https://images.unsplash.com/photo-1509773896068-7fd415d91e2e?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80";
  
  return (
    <div 
      className={cn(
        "segment rounded-lg overflow-hidden cursor-pointer transition-all duration-300 transform hover:scale-105", 
        unlocked && asset?.redirectUrl && "hover:shadow-lg",
        className
      )} 
      data-segment-id={id}
      onClick={handleSegmentClick}
    >
      <div className="relative aspect-square bg-gray-100">
        <img 
          src={imageError ? fallbackImageUrl : (asset?.imageUrl || imageUrl)}
          alt={asset?.title || altText}
          onError={handleImageError}
          className={cn(
            "w-full h-full object-cover", 
            !unlocked && "grayscale"
          )}
        />
        {!unlocked ? (
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
        ) : asset?.redirectUrl && (
          <div className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full">
            <ExternalLink className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
};

export default MapSegment;
