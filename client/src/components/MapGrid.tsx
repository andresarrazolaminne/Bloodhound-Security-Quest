import React from "react";
import MapSegment from "./MapSegment";

interface MapGridProps {
  unlockedSegments: number[];
}

const MapGrid = ({ unlockedSegments }: MapGridProps) => {
  // Los 9 segmentos del mapa
  const segmentIds = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Tu Mapa de Logros</h2>
      
      <div className="grid grid-cols-3 gap-4">
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
