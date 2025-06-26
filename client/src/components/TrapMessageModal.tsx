import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import HtmlContent from './HtmlContent';

interface TrapMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  trapMessage?: string;
  segmentId: number;
  points: number;
}

const TrapMessageModal = ({ 
  isOpen, 
  onClose, 
  trapMessage, 
  segmentId, 
  points 
}: TrapMessageModalProps) => {
  const defaultMessage = `
    <div style="text-align: center;">
      <h2 style="color: #f59e0b; margin-bottom: 16px;">🎯 ¡Situación de Trampa!</h2>
      <p style="margin-bottom: 12px;">Esta situación <strong>NO presenta riesgos reales</strong>.</p>
      <p style="color: #6b7280;">Has identificado correctamente una trampa en el entrenamiento de seguridad laboral.</p>
      <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 12px; margin-top: 16px;">
        <strong style="color: #92400e;">+${points} puntos falsos agregados</strong>
      </div>
    </div>
  `;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-orange-600" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            QR Trampa Detectado
          </DialogTitle>
          <DialogDescription className="text-center">
            Segmento {segmentId} - Situación de entrenamiento
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <HtmlContent 
            html={trapMessage || defaultMessage} 
            className="text-center"
          />
        </div>
        
        <div className="flex justify-center pt-4">
          <Button onClick={onClose} className="w-full">
            Continuar Entrenamiento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrapMessageModal;