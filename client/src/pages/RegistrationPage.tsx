import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { register } from "@/lib/api";
import { useUser } from "@/context/UserContext";
import BrainLoader from "@/components/BrainLoader";

const RegistrationPage = () => {
  const [name, setName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const { toast } = useToast();
  const { setCurrentUser } = useUser();
  const [activeVenues, setActiveVenues] = useState<Array<{id: number, name: string, location?: string}>>([]);
  
  // System configuration for consistent styling
  const [systemConfig, setSystemConfig] = useState({
    loginTitle: 'Registro',
    loginSubtitle: 'Usuario Nuevo',
    loginWelcomeText: 'Completa tu registro para acceder al reto',
    loginButtonText: 'Crear mi cuenta',
    loginDocumentLabel: 'Número de documento',
    loginNameLabel: 'Nombre completo',
    backgroundImageUrl: 'https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Textura-fondo-pagina.png',
    gradientStartColor: '#bb2558',
    gradientEndColor: '#e8cf00',
    loginLogoImageUrl: 'https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png',
    registrationImageUrl: 'https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png',
    headerLogoImageUrl: 'https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png',
    headerLogoSize: 32,
    headerBackgroundColor: '#3b82f6',
    headerTextColor: '#ffffff'
  });

  // Load active venues for dropdown
  useEffect(() => {
    const loadActiveVenues = async () => {
      try {
        const response = await fetch('/api/venues/active');
        if (response.ok) {
          const data = await response.json();
          setActiveVenues(data.venues || []);
        }
      } catch (error) {
        console.error('Error loading active venues:', error);
      }
    };
    loadActiveVenues();
  }, []);

  // Load system configuration for consistent styling
  useEffect(() => {
    const loadSystemConfig = async () => {
      try {
        const response = await fetch('/api/system-config?t=' + Date.now());
        if (response.ok) {
          const data = await response.json();
          const config = data.config || {};
          
          // Update CSS custom properties for consistent styling
          const timestamp = Date.now();
          document.documentElement.style.setProperty('--background-image-url', config.backgroundImageUrl ? `url('${config.backgroundImageUrl}?t=${timestamp}')` : '');
          document.documentElement.style.setProperty('--gradient-start-color', config.gradientStartColor || '#bb2558');
          document.documentElement.style.setProperty('--gradient-end-color', config.gradientEndColor || '#e8cf00');
          
          const loginLogoUrl = config.loginLogoImageUrl || 'https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png';
          
          // Preload the login logo image before showing the page
          const img = new Image();
          img.onload = () => {
            setSystemConfig({
              loginTitle: config.loginTitle || 'Registro',
              loginSubtitle: config.loginSubtitle || 'Usuario Nuevo',
              loginWelcomeText: config.loginWelcomeText || 'Completa tu registro para acceder al reto',
              loginButtonText: 'Crear mi cuenta',
              loginDocumentLabel: config.loginDocumentLabel || 'Número de documento',
              loginNameLabel: config.loginNameLabel || 'Nombre completo',
              backgroundImageUrl: config.backgroundImageUrl || 'https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Textura-fondo-pagina.png',
              gradientStartColor: config.gradientStartColor || '#bb2558',
              gradientEndColor: config.gradientEndColor || '#e8cf00',
              loginLogoImageUrl: loginLogoUrl,
              registrationImageUrl: config.registrationImageUrl || 'https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png',
              headerLogoImageUrl: config.headerLogoImageUrl || 'https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png',
              headerLogoSize: config.headerLogoSize || 32,
              headerBackgroundColor: config.headerBackgroundColor || '#3b82f6',
              headerTextColor: config.headerTextColor || '#ffffff'
            });
            setIsLoadingConfig(false);
          };
          img.onerror = () => {
            // Fallback if image fails to load
            setSystemConfig({
              loginTitle: config.loginTitle || 'Registro',
              loginSubtitle: config.loginSubtitle || 'Usuario Nuevo', 
              loginWelcomeText: config.loginWelcomeText || 'Completa tu registro para acceder al reto',
              loginButtonText: 'Crear mi cuenta',
              loginDocumentLabel: config.loginDocumentLabel || 'Número de documento',
              loginNameLabel: config.loginNameLabel || 'Nombre completo',
              backgroundImageUrl: config.backgroundImageUrl || 'https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Textura-fondo-pagina.png',
              gradientStartColor: config.gradientStartColor || '#bb2558',
              gradientEndColor: config.gradientEndColor || '#e8cf00',
              loginLogoImageUrl: 'https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png',
              registrationImageUrl: config.registrationImageUrl || 'https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png'
            } as any);
            setIsLoadingConfig(false);
          };
          img.src = loginLogoUrl;
        } else {
          setIsLoadingConfig(false);
        }
      } catch (error) {
        console.error('Error loading system configuration:', error);
        setIsLoadingConfig(false);
      }
    };

    loadSystemConfig();
  }, []);

  // Extract document number from URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(location.split("?")[1]);
    const docNumber = params.get("documentNumber");
    if (docNumber) {
      setDocumentNumber(docNumber);
    }
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !documentNumber.trim()) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos",
        variant: "destructive"
      });
      return;
    }

    if (!selectedVenueId) {
      toast({
        title: "Error",
        description: "Por favor selecciona una sede",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log("Enviando datos:", { documentNumber, name, venueId: selectedVenueId });
      const response = await register(documentNumber, name, selectedVenueId);

      setCurrentUser(response.user);
      setLocation("/map");

      toast({
        title: "Bienvenido",
        description: "Tu cuenta ha sido creada exitosamente",
      });
    } catch (error: any) {
      console.error("Error en registro:", error);

      // Intentar extraer el mensaje de error detallado
      let errorMessage = "No pudimos registrar tu cuenta. Inténtalo de nuevo.";

      if (error instanceof Response) {
        try {
          const errorData = await error.json();
          if (errorData?.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          // Si no podemos parsear el error, usamos el mensaje genérico
          errorMessage = `Error ${error.status}: ${error.statusText}`;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading screen while configuration is loading
  if (isLoadingConfig) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 map-page-bg">
        <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm shadow-xl">
          <CardContent className="pt-6 flex flex-col items-center justify-center py-12">
            <BrainLoader size="large" text="Cargando configuración..." />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`flex flex-col min-h-screen text-white map-page-bg transition-opacity duration-300 ${isLoadingConfig ? 'opacity-0' : 'opacity-100'}`}>
      
      {/* Header */}
      <header 
        className="shadow-md"
        style={{ 
          backgroundColor: systemConfig.headerBackgroundColor,
          color: systemConfig.headerTextColor 
        }}
      >
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <img 
            src={systemConfig.headerLogoImageUrl || "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png"} 
            alt="Logo" 
            className="object-contain"
            style={{ height: `${systemConfig.headerLogoSize}px` }}
          />
          <div className="flex items-center">
            {/* Espacio vacío para el usuario cuando no está logueado */}
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <div className="flex flex-col items-center justify-center flex-1 p-4">
      <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm shadow-xl border-0">
        <CardContent className="pt-8 pb-8 px-6">
          <div className="flex flex-col items-center justify-center mb-8">
            {/* Logo personalizable */}
            <div className="relative my-3">
              <img 
                src={systemConfig.registrationImageUrl} 
                alt="Logo" 
                className="w-24 h-24 object-contain animate-pulse"
              />
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-3/4 h-1 bg-yellow-300/20 rounded-full blur-md"></div>
            </div>
            
            <h2 className="text-xl font-semibold text-gray-700 mb-1 text-center">{systemConfig.loginSubtitle}</h2>
            <p className="text-center text-gray-600 text-sm">{systemConfig.loginWelcomeText}</p>
            
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <input type="hidden" name="documentNumber" value={documentNumber} />

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="document-number" className="block text-base font-medium text-gray-700">
                  {systemConfig.loginDocumentLabel}
                </label>
                <Input
                  id="document-number"
                  type="text"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="Ingresa tu número de cédula"
                  className="w-full py-6 text-lg bg-white/80"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="user-name" className="block text-base font-medium text-gray-700">
                  {systemConfig.loginNameLabel}
                </label>
                <Input
                  id="user-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ingresa tu nombre completo"
                  className="w-full py-6 text-lg bg-white/80"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="venue-select" className="block text-base font-medium text-gray-700">
                  Selecciona tu sede
                </label>
                <select
                  id="venue-select"
                  value={selectedVenueId || ''}
                  onChange={(e) => setSelectedVenueId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full py-6 text-lg bg-white/80 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Selecciona una sede...</option>
                  {activeVenues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name} {venue.location && `- ${venue.location}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <Button 
                type="submit"
                className="w-full flex items-center justify-center py-6 text-base"
                disabled={isLoading}
              >
                <span>{isLoading ? "Registrando..." : systemConfig.loginButtonText}</span>
                {isLoading ? (
                  <BrainLoader size="small" className="ml-2" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 ml-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                )}
              </Button>
              <Button 
                type="button"
                variant="outline"
                className="w-full py-6 text-base"
                onClick={() => setLocation("/")}
              >
                Volver al inicio
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default RegistrationPage;