import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import HtmlContent from './HtmlContent';

interface SegmentContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  segmentId: number;
  modalContent?: string;
  title?: string;
}

const SegmentContentModal = ({ 
  isOpen, 
  onClose, 
  segmentId, 
  modalContent,
  title 
}: SegmentContentModalProps) => {
  
  // Debug logging
  React.useEffect(() => {
    console.log('SegmentContentModal - Estado cambió:', {
      isOpen,
      segmentId,
      hasModalContent: !!modalContent,
      modalContentLength: modalContent?.length || 0,
      title
    });
  }, [isOpen, segmentId, modalContent, title]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] max-w-[95vw] md:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {title || `Segmento ${segmentId} Desbloqueado`}
          </DialogTitle>
        </DialogHeader>
        
        <div className="prose prose-sm max-w-none overflow-y-auto max-h-[70vh] pr-2">
          {modalContent ? (
            <div className="w-full">
              <HtmlContent html={modalContent} className="w-full iframe-responsive" />
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-green-600 text-4xl mb-4">✅</div>
              <h3 className="text-lg font-semibold mb-2">¡Segmento Desbloqueado!</h3>
              <p className="text-gray-600">
                Has desbloqueado exitosamente el segmento {segmentId}.
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SegmentContentModal;