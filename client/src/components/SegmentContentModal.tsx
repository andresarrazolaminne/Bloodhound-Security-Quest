import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import HtmlContent from './HtmlContent';

// Componente para renderizar contenido HTML personalizado
const CustomModalContent = ({ content, onClose }: { content: string, onClose: () => void }) => {
  const [processedContent, setProcessedContent] = React.useState('');
  const [processedStyles, setProcessedStyles] = React.useState('');

  React.useEffect(() => {
    // Procesar el contenido HTML para adaptarlo al modal existente
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    
    // Extraer y procesar el contenido del modal
    const modalContent = tempDiv.querySelector('.modal-content');
    if (modalContent) {
      // Remover el botón de cerrar original
      const closeButtons = modalContent.querySelectorAll('.close-modal');
      closeButtons.forEach(btn => btn.remove());
      
      setProcessedContent(modalContent.innerHTML);
    } else {
      // Si no encuentra .modal-content, usar todo el contenido pero sin scripts
      const scripts = tempDiv.querySelectorAll('script');
      scripts.forEach(script => script.remove());
      setProcessedContent(tempDiv.innerHTML);
    }
    
    // Extraer y adaptar estilos CSS
    const styleTag = tempDiv.querySelector('style');
    if (styleTag) {
      let styles = styleTag.textContent || '';
      
      // Remover estilos del modal principal ya que usamos nuestro DialogContent
      styles = styles.replace(/\.modal\s*{[^}]*}/g, '');
      styles = styles.replace(/\.modal-content\s*{[^}]*}/g, '');
      
      // Adaptar otros estilos para que funcionen en nuestro contexto
      styles = styles.replace(/\.close-modal/g, '.custom-close-modal');
      
      setProcessedStyles(styles);
    }
    
    // NO ejecutar scripts automáticamente para evitar errores
    // En su lugar, manejar la interactividad de otra manera si es necesario
    
  }, [content]);

  // Función para manejar clics en botones dentro del contenido
  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Si se hace clic en un botón de cerrar personalizado
    if (target.classList.contains('close-modal') || 
        target.classList.contains('custom-close-modal') ||
        target.textContent?.toLowerCase().includes('cerrar')) {
      e.preventDefault();
      onClose();
    }
  };
  

  
  return (
    <div className="custom-modal-wrapper" onClick={handleContentClick}>
      {processedStyles && (
        <style dangerouslySetInnerHTML={{ __html: processedStyles }} />
      )}
      <div dangerouslySetInnerHTML={{ __html: processedContent }} />
    </div>
  );
};

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
  
  // Función para detectar el tipo de contenido
  const detectContentType = (content: string) => {
    if (!content) return 'none';
    
    // Detectar iframe de YouTube
    if (content.includes('youtube.com/embed') || content.includes('youtu.be')) {
      return 'youtube';
    }
    
    // Detectar HTML completo con estructura de modal
    if (content.includes('<div') && content.includes('modal') && content.includes('<style>')) {
      return 'html-modal';
    }
    
    // Detectar iframe general
    if (content.includes('<iframe')) {
      return 'iframe';
    }
    
    // Contenido HTML general
    return 'html';
  };

  const contentType = detectContentType(modalContent || '');
  
  // Debug logging
  React.useEffect(() => {
    console.log('SegmentContentModal - Estado cambió:', {
      isOpen,
      segmentId,
      hasModalContent: !!modalContent,
      modalContentLength: modalContent?.length || 0,
      title,
      contentType
    });
  }, [isOpen, segmentId, modalContent, title, contentType]);

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
              {contentType === 'html-modal' ? (
                // Para contenido HTML con modal personalizado, usar el contenido completo pero adaptado
                <CustomModalContent content={modalContent} onClose={onClose} />
              ) : contentType === 'youtube' ? (
                // Para videos de YouTube, optimizar para responsividad
                <div className="youtube-container">
                  <HtmlContent html={modalContent} className="w-full iframe-responsive" />
                </div>
              ) : (
                // Para cualquier otro contenido HTML
                <HtmlContent html={modalContent} className="w-full" />
              )}
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