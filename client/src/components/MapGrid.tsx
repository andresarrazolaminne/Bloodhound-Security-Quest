import React, { useState, useEffect, useRef } from "react";
import MapSegment from "./MapSegment";

interface MapGridProps {
  unlockedSegments: number[];
}

const MapGrid = ({ unlockedSegments }: MapGridProps) => {
  // Los 9 segmentos del mapa
  const segmentIds = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  
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
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Tu Mapa de Logros</h2>
      
      <div className={`grid grid-cols-3 gap-4 ${updatingSegments ? 'opacity-50 transition-opacity' : ''}`}>
        {segmentIds.map((id) => (
          <MapSegment
            key={id}
            id={id}
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
