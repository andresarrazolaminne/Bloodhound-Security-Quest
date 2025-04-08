import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface AuthCertificateProps {
  className?: string;
}

const AuthCertificate = ({ className }: AuthCertificateProps) => {
  return (
    <div className={cn("relative", className)}>
      <div className="absolute -top-1 -right-1 bg-primary/80 text-white text-xs rounded-full px-2 py-1">
        Certificado
      </div>
      <div className="w-16 h-16 flex items-center justify-center bg-white rounded-full shadow-md p-2 overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1569937756447-1d44f657c8c0?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80" 
          alt="Certificado de autenticidad" 
          className="w-10 h-10 animate-spin-slow"
        />
      </div>
    </div>
  );
};

export default AuthCertificate;
