import React from "react";
import { cn } from "@/lib/utils";
import { Button, ButtonProps } from "@/components/ui/button";

// Botones estilo pixel art inspirados en la imagen de la caja
export const BoxButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn(
          // Aplicar estilo pixel art
          "pixel-art",
          // Reset de estilos base y estructura
          "relative border-0 overflow-hidden",
          // Colores inspirados en la caja (naranja/dorado)
          "bg-gradient-to-b from-amber-400 to-amber-600",
          // Texto para legibilidad
          "text-white font-bold",
          // Bordes estilo pixel art pronunciados
          "border-[3px] border-solid box-border",
          // Colores de los bordes: oscuros abajo/derecha, claros arriba/izquierda
          "border-b-amber-900 border-r-amber-900 border-t-amber-300 border-l-amber-300",
          // Padding ajustado para tamaño adecuado
          "py-1.5 px-4",
          // Dar profundidad con sombra
          "shadow-[2px_2px_0px_rgba(0,0,0,0.2)]",
          // Efectos hover
          "hover:brightness-110 hover:translate-y-[1px] hover:shadow-[1px_1px_0px_rgba(0,0,0,0.2)]",
          "hover:border-b-amber-800 hover:border-r-amber-800 hover:border-t-amber-400 hover:border-l-amber-400",
          // Efectos activos (presionado)
          "active:brightness-90 active:translate-y-[2px] active:shadow-none",
          "active:border-b-amber-700 active:border-r-amber-700 active:border-t-amber-500 active:border-l-amber-500",
          // Transición suave
          "transition-all duration-150 ease-in-out",
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

// Variante outline del botón pixel art
export const OutlineBoxButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="outline"
        className={cn(
          // Aplicar estilo pixel art
          "pixel-art",
          // Reset de estilos base
          "relative border-0 overflow-hidden",
          // Fondo suave
          "bg-gradient-to-b from-amber-50 to-amber-200",
          // Texto oscuro para contraste
          "text-amber-900 font-medium",
          // Bordes estilo pixel art sutiles
          "border-[2px] border-solid box-border",
          // Colores de los bordes: oscuros abajo/derecha, claros arriba/izquierda
          "border-b-amber-400 border-r-amber-400 border-t-amber-100 border-l-amber-100",
          // Padding optimizado
          "py-1.5 px-4",
          // Sombra sutil
          "shadow-[1px_1px_0px_rgba(0,0,0,0.1)]",
          // Efecto hover
          "hover:from-amber-100 hover:to-amber-300 hover:translate-y-[1px] hover:shadow-none",
          "hover:border-b-amber-500 hover:border-r-amber-500 hover:border-t-amber-200 hover:border-l-amber-200",
          // Efecto activo (presionado)
          "active:from-amber-200 active:to-amber-400 active:translate-y-[2px]",
          "active:border-b-amber-400 active:border-r-amber-400 active:border-t-amber-300 active:border-l-amber-300",
          // Transición suave
          "transition-all duration-150 ease-in-out",
          // Personalización adicional
          className
        )}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

OutlineBoxButton.displayName = "OutlineBoxButton";