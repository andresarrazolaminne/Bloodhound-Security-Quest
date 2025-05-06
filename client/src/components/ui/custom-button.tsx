import React from "react";
import { cn } from "@/lib/utils";
import { Button, ButtonProps } from "@/components/ui/button";

// Un componente de botón personalizado con el estilo de la caja
export const BoxButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn(
          // Base: usar imagen de fondo y ajustarla
          "relative border-0 overflow-hidden text-white font-medium",
          // Background: Aplicar la imagen de caja como fondo con repetición en bordes
          "bg-no-repeat bg-cover bg-center",
          // Estilo específico que aplica la imagen como fondo
          "[background-image:url('https://deuouqyoujoig.cloudfront.net/uploads/2025/QRCODEQUEST-IMAGENES-RETO/Caja.png')]",
          // Box shadow para darle más profundidad
          "shadow-md hover:shadow-lg",
          // Transición suave en hover
          "transition-all duration-200 hover:brightness-110",
          // Permitir sobrescribir con clases adicionales
          className
        )}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

BoxButton.displayName = "BoxButton";

// Una variante con outline pero manteniendo el estilo de la caja
export const OutlineBoxButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="outline"
        className={cn(
          // Base
          "relative border-0 overflow-hidden",
          // Background con opacidad para efecto "outline"
          "bg-no-repeat bg-cover bg-center bg-opacity-70 text-gray-700",
          // Aplicar imagen con menor opacidad para efecto outline
          "[background-image:url('https://deuouqyoujoig.cloudfront.net/uploads/2025/QRCODEQUEST-IMAGENES-RETO/Caja.png')]",
          // Efecto de overlay blanco para atenuar la imagen
          "before:content-[''] before:absolute before:inset-0 before:bg-white/80 before:z-0",
          // Asegurar que el contenido esté por encima del overlay
          "hover:before:bg-white/60",
          // Transición
          "transition-all duration-200",
          // Personalización adicional
          className
        )}
        {...props}
      >
        {/* Contenedor para garantizar que el contenido esté encima del overlay */}
        <span className="relative z-10">{children}</span>
      </Button>
    );
  }
);

OutlineBoxButton.displayName = "OutlineBoxButton";