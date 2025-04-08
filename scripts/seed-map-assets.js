// Script para poblar la tabla map_segment_assets con los datos predeterminados de los segmentos

import { db } from '../server/db.js';
import { mapSegmentAssets } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function seedMapAssets() {
  try {
    console.log('Iniciando la siembra de datos de segmentos del mapa...');
    
    // Datos de los segmentos del mapa (9 segmentos en total)
    const segmentData = [
      {
        segmentId: 1,
        imageUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400&h=400&fit=crop',
        redirectUrl: 'https://unsplash.com/photos/blue-and-purple-sky-awv7vj_hKp0',
        title: 'Segmento 1',
        description: 'Colorido atardecer con tonos azules y morados'
      },
      {
        segmentId: 2,
        imageUrl: 'https://images.unsplash.com/photo-1603366615917-1fa6dad5c4fa?w=400&h=400&fit=crop',
        redirectUrl: 'https://unsplash.com/photos/blue-and-orange-abstract-painting-JpYroTab9a0',
        title: 'Segmento 2',
        description: 'Abstracción en tonos azules y anaranjados'
      },
      {
        segmentId: 3,
        imageUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&h=400&fit=crop',
        redirectUrl: 'https://unsplash.com/photos/abstract-painting-in-blue-and-orange-sYffw0LNr7s',
        title: 'Segmento 3',
        description: 'Resplandor naranja sobre fondo azul'
      },
      {
        segmentId: 4,
        imageUrl: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=400&fit=crop',
        redirectUrl: 'https://unsplash.com/photos/silhouette-photo-of-person-near-body-of-water-nz-TnRx0Eeo',
        title: 'Segmento 4',
        description: 'Silueta sobre agua al atardecer'
      },
      {
        segmentId: 5,
        imageUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=400&h=400&fit=crop',
        redirectUrl: 'https://unsplash.com/photos/spiral-staircase-5i0GnoTTjSE',
        title: 'Segmento 5',
        description: 'Escalera de caracol en tonos azules'
      },
      {
        segmentId: 6,
        imageUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=400&h=400&fit=crop',
        redirectUrl: 'https://unsplash.com/photos/green-leafed-plant-y8lCoTRanuQ',
        title: 'Segmento 6',
        description: 'Hojas verdes con rocío'
      },
      {
        segmentId: 7,
        imageUrl: 'https://images.unsplash.com/photo-1548504769-900b70ed122e?w=400&h=400&fit=crop',
        redirectUrl: 'https://unsplash.com/photos/green-sequoia-trees-oyMTNjTpTFU',
        title: 'Segmento 7',
        description: 'Árboles secuoyas verdes'
      },
      {
        segmentId: 8,
        imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=400&fit=crop',
        redirectUrl: 'https://unsplash.com/photos/green-leafed-forest-trees-KMn4VEeEPR8',
        title: 'Segmento 8',
        description: 'Bosque con luz solar'
      },
      {
        segmentId: 9,
        imageUrl: 'https://images.unsplash.com/photo-1505245208761-ba872912fac0?w=400&h=400&fit=crop',
        redirectUrl: 'https://unsplash.com/photos/island-in-the-middle-of-lake-3I4OcyKiOxM',
        title: 'Segmento 9',
        description: 'Isla en medio de un lago'
      }
    ];

    // Procesar cada segmento
    for (const segment of segmentData) {
      // Verificar si ya existe
      const existing = await db
        .select({ id: mapSegmentAssets.id })
        .from(mapSegmentAssets)
        .where(eq(mapSegmentAssets.segmentId, segment.segmentId));

      if (existing.length > 0) {
        // Actualizar registro existente
        await db
          .update(mapSegmentAssets)
          .set({
            imageUrl: segment.imageUrl,
            redirectUrl: segment.redirectUrl,
            title: segment.title,
            description: segment.description,
            updatedAt: new Date()
          })
          .where(eq(mapSegmentAssets.segmentId, segment.segmentId));
        
        console.log(`Segmento ${segment.segmentId} actualizado`);
      } else {
        // Crear nuevo registro
        await db
          .insert(mapSegmentAssets)
          .values({
            ...segment,
            updatedAt: new Date()
          });
        
        console.log(`Segmento ${segment.segmentId} creado`);
      }
    }

    console.log('¡Siembra completada con éxito!');
    process.exit(0);
  } catch (error) {
    console.error('Error durante la siembra de datos:', error);
    process.exit(1);
  }
}

// Ejecutar la función
seedMapAssets();