import { useMemo } from "react";
import MapSegment from "./MapSegment";
import { MAP_SEGMENTS } from "@/lib/mapSegmentsData";

interface MapGridProps {
  unlockedSegments: number[];
}

const MapGrid = ({ unlockedSegments }: MapGridProps) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Tu Mapa de Logros</h2>
      
      <div className="grid grid-cols-3 gap-4">
        {MAP_SEGMENTS.map((segment) => (
          <MapSegment
            key={segment.id}
            id={segment.id}
            imageUrl={segment.imageUrl}
            altText={segment.altText}
            unlocked={unlockedSegments.includes(segment.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default MapGrid;
