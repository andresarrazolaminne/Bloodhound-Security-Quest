import React from 'react';
import QRGenerator from '@/tools/QRGenerator';

const QRGeneratorPage = () => {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-primary">
          Generador de Códigos QR para Segmentos del Mapa
        </h1>
        <p className="text-center mb-8 text-gray-600 max-w-2xl mx-auto">
          Esta herramienta te permite generar códigos QR de prueba para desbloquear segmentos del mapa.
          Simplemente selecciona un ID de segmento o genera todos los códigos QR a la vez.
        </p>
        <QRGenerator />
      </div>
    </div>
  );
};

export default QRGeneratorPage;