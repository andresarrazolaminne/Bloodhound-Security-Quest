import React, { useState, useEffect, useRef } from "react";
import MapSegment from "./MapSegment";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { readOkJson } from "@/lib/api";
import { playableSegmentIdsForCampaign } from "@shared/mapGrid";

interface MapGridProps {
  unlockedSegments: number[];
  /** Slug de campaña desde la ruta; evita pedir assets de otro tenant si el contexto aún no coincide. */
  campaignSlug?: string;
  gapSize?: 'none' | 'x-small' | 'small' | 'medium' | 'large'; // Tamaño de la separación entre imágenes
  gridSize?: '3x3' | '3x2' | '2x3' | '4x2' | '2x4'; // Tamaño de la cuadrícula (columnas x filas)
}

const MapGrid = ({
  unlockedSegments,
  campaignSlug,
  gapSize = 'medium',
  gridSize = '3x3',
}: MapGridProps) => {
  // Fetch all map assets to filter out trap segments
  const { data: assetsData } = useQuery({
    queryKey: ["/api/map-assets", campaignSlug ?? ""],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/map-assets", undefined, campaignSlug);
      if (!response.ok) {
        const text = (await response.text()) || response.statusText;
        throw new Error(`${response.status}: ${text}`);
      }
      return readOkJson<{ assets: Array<{ isTrap: boolean; segmentId: number }> }>(response);
    },
  });

  const segmentIds = playableSegmentIdsForCampaign(assetsData?.assets ?? [], gridSize);
  
  // Mantener una referencia de los segmentos actuales para comparar con los nuevos
  const previousUnlockedRef = useRef<number[]>([]);
  const [updatingSegments, setUpdatingSegments] = useState(false);
  
  // Detectar cambios en los segmentos desbloqueados
  useEffect(() => {
    // Ver si hay diferencias entre los segmentos anteriores y los actuales
    const hasChanges = unlockedSegments.length !== previousUnlockedRef.current.length ||
      unlockedSegments.some(id => !previousUnlockedRef.current.includes(id));
      
    if (hasChanges) {
      console.log("Actualizando el estado de las fichas del mapa...");
      setUpdatingSegments(true);
      
      // Una pequeña animación/transición antes de actualizar
      setTimeout(() => {
        previousUnlockedRef.current = [...unlockedSegments];
        setUpdatingSegments(false);
      }, 100);
    }
  }, [unlockedSegments]);
  
  // Escuchar el evento personalizado para cuando se desbloquea un segmento
  useEffect(() => {
    const handleMapSegmentUnlock = (event: Event) => {
      const customEvent = event as CustomEvent<{ segmentId: number, timestamp: number }>;
      console.log("Evento de segmento desbloqueado recibido:", customEvent.detail);
      
      // Forzar una actualización de la visualización
      setUpdatingSegments(true);
      
      // Esperar un momento y luego restablecer
      setTimeout(() => {
        setUpdatingSegments(false);
      }, 100);
    };
    
    // Registrar el listener para el evento personalizado
    window.addEventListener('mapSegmentUnlocked', handleMapSegmentUnlock);
    
    // Limpiar el listener cuando el componente se desmonte
    return () => {
      window.removeEventListener('mapSegmentUnlocked', handleMapSegmentUnlock);
    };
  }, []);
  
  // Determinar la clase de espaciado según el tamaño solicitado
  const getGapClass = () => {
    switch (gapSize) {
      case 'none':
        return 'gap-0'; // Sin espaciado
      case 'x-small':
        return 'gap-1'; // Espaciado extra pequeño - 0.25rem (4px)
      case 'small':
        return 'gap-2'; // Espaciado pequeño - 0.5rem (8px)
      case 'large':
        return 'gap-6'; // Espaciado grande - 1.5rem (24px)
      case 'medium':
      default:
        return 'gap-4'; // Espaciado mediano - 1rem (16px)
    }
  };
  
  // Columnas con CSS inline: Tailwind no incluye `grid-cols-${n}` construido por string en el bundle de producción.
  const columnCount = Math.max(1, parseInt(gridSize.split("x")[0], 10) || 3);

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-4 mb-6">
      <div
        className={`grid ${getGapClass()} ${updatingSegments ? "opacity-50 transition-opacity" : ""}`}
        style={{
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        }}
      >
        {segmentIds.map((id: number) => (
          <MapSegment
            key={id}
            id={id}
            campaignSlug={campaignSlug}
            imageUrl=""
            altText={`Segmento del mapa ${id}`}
            unlocked={unlockedSegments.includes(id)}
          />
        ))}
      </div>
    </div>
  );
};

export default MapGrid;
