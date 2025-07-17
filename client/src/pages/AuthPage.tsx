import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/context/UserContext";
import { login } from "@/lib/api";
import BrainLoader from "@/components/BrainLoader";

const AuthPage = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setCurrentUser } = useUser();
  
  // Manejar parámetros de redirección para QR codes
  const urlParams = new URLSearchParams(window.location.search);
  const redirectUrl = urlParams.get('redirect');
  
  // System configuration for login page customization - no defaults
  const [systemConfig, setSystemConfig] = useState({
    loginTitle: '',
    loginSubtitle: '',
    loginWelcomeText: '',
    loginButtonText: '',
    loginDocumentLabel: '',
    loginNameLabel: '',
    backgroundImageUrl: '',
    gradientStartColor: '',
    gradientEndColor: '',
    loginLogoImageUrl: '',
    preloadImageUrl: '',
    headerLogoImageUrl: '',
    headerLogoSize: 32,
    headerBackgroundColor: '',
    headerTextColor: '',
    loadingText: ''
  });
  
  const [documentNumber, setDocumentNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [loginImageLoaded, setLoginImageLoaded] = useState(false);
  const [hasAttemptedLogin, setHasAttemptedLogin] = useState(false);
  
  const lastDocument = localStorage.getItem('lastDocument');

  useEffect(() => {
    const loadSystemConfig = async () => {
      try {
        const response = await fetch('/api/system-config');
        if (!response.ok) throw new Error('Failed to load config');
        const data = await response.json();
        const config = data.config;
        
        // Use only database values - no fallbacks
        const loginLogoUrl = config.loginLogoImageUrl;
        
        if (loginLogoUrl) {
          // Preload the login logo image before setting the state
          const img = new Image();
          img.onload = () => {
            setLoginImageLoaded(true);
            setSystemConfig({
              loginTitle: config.loginTitle,
              loginSubtitle: config.loginSubtitle,
              loginWelcomeText: config.loginWelcomeText,
              loginButtonText: config.loginButtonText,
              loginDocumentLabel: config.loginDocumentLabel,
              loginNameLabel: config.loginNameLabel,
              backgroundImageUrl: config.backgroundImageUrl,
              gradientStartColor: config.gradientStartColor,
              gradientEndColor: config.gradientEndColor,
              loginLogoImageUrl: loginLogoUrl,
              preloadImageUrl: config.preloadImageUrl,
              headerLogoImageUrl: config.headerLogoImageUrl,
              headerLogoSize: config.headerLogoSize,
              headerBackgroundColor: config.headerBackgroundColor,
              headerTextColor: config.headerTextColor,
              loadingText: config.loadingText
            });
          };
          img.onerror = () => {
            // If image fails to load, use empty config
            setLoginImageLoaded(true);
            setSystemConfig({
              loginTitle: config.loginTitle,
              loginSubtitle: config.loginSubtitle,
              loginWelcomeText: config.loginWelcomeText,
              loginButtonText: config.loginButtonText,
              loginDocumentLabel: config.loginDocumentLabel,
              loginNameLabel: config.loginNameLabel,
              backgroundImageUrl: config.backgroundImageUrl,
              gradientStartColor: config.gradientStartColor,
              gradientEndColor: config.gradientEndColor,
              loginLogoImageUrl: '', // No image if failed to load
              preloadImageUrl: config.preloadImageUrl,
              headerLogoImageUrl: config.headerLogoImageUrl,
              headerLogoSize: config.headerLogoSize,
              headerBackgroundColor: config.headerBackgroundColor,
              headerTextColor: config.headerTextColor,
              loadingText: config.loadingText
            });
          };
          img.src = loginLogoUrl;
        } else {
          // No image configured, use database config without image
          setLoginImageLoaded(true);
          setSystemConfig({
            loginTitle: config.loginTitle,
            loginSubtitle: config.loginSubtitle,
            loginWelcomeText: config.loginWelcomeText,
            loginButtonText: config.loginButtonText,
            loginDocumentLabel: config.loginDocumentLabel,
            loginNameLabel: config.loginNameLabel,
            backgroundImageUrl: config.backgroundImageUrl,
            gradientStartColor: config.gradientStartColor,
            gradientEndColor: config.gradientEndColor,
            loginLogoImageUrl: '',
            preloadImageUrl: config.preloadImageUrl,
            headerLogoImageUrl: config.headerLogoImageUrl,
            headerLogoSize: config.headerLogoSize,
            headerBackgroundColor: config.headerBackgroundColor,
            headerTextColor: config.headerTextColor,
            loadingText: config.loadingText
          });
          setIsLoadingConfig(false);
        }
      } catch (error) {
        console.error('Error loading system config:', error);
        setIsLoadingConfig(false);
        setLoginImageLoaded(true);
      }
    };
    
    loadSystemConfig();
  }, []);

  const performLogin = async (docNumber: string) => {
    // Prevent double submission
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setHasAttemptedLogin(true);
    
    try {
      const response = await login(docNumber);
      
      if (response.user) {
        setCurrentUser(response.user);
        localStorage.setItem('lastDocument', docNumber);
        
        // Verificar si hay una URL de redirección (para QR codes)
        if (redirectUrl) {
          setLocation(redirectUrl);
        } else {
          setLocation('/map');
        }
        
        toast({
          title: "¡Bienvenido!",
          description: "Has iniciado sesión correctamente",
          variant: "default"
        });
      } else {
        // Usuario no existe, redirigir a registro
        localStorage.setItem('tempDocument', docNumber);
        // Mantener la URL de redirección para después del registro
        if (redirectUrl) {
          setLocation(`/register?redirect=${encodeURIComponent(redirectUrl)}`);
        } else {
          setLocation('/register');
        }
      }
    } catch (error: any) {
      if (error.status === 404) {
        // Usuario no existe, redirigir a registro
        localStorage.setItem('tempDocument', docNumber);
        // Mantener la URL de redirección para después del registro
        if (redirectUrl) {
          setLocation(`/register?redirect=${encodeURIComponent(redirectUrl)}`);
        } else {
          setLocation('/register');
        }
      } else if (error.status === 400) {
        // Error de validación - mostrar mensaje específico
        toast({
          title: "Error",
          description: "Número de documento inválido",
          variant: "destructive"
        });
      } else {
        // Try to get error message from response
        let errorMessage = "Error al iniciar sesión";
        if (error instanceof Response) {
          try {
            const errorData = await error.json();
            errorMessage = errorData.message || errorMessage;
          } catch (e) {
            // Could not parse error response
          }
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Trim whitespace and validate
    const trimmedDocumentNumber = documentNumber.trim();
    
    if (!trimmedDocumentNumber) {
      toast({
        title: "Error",
        description: "Por favor ingresa tu número de documento",
        variant: "destructive"
      });
      return;
    }

    await performLogin(trimmedDocumentNumber);
  };

  const handleChangeUser = () => {
    localStorage.removeItem('lastDocument');
    setLocation('/auth');
  };

  // Mostrar loader mientras se cargan las configuraciones
  if (isLoadingConfig || !loginImageLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white" style={{ backgroundColor: '#f3f4f6' }}>
        <BrainLoader 
          text={systemConfig.loadingText || 'Cargando tu mapa...'}
          className="flex flex-col items-center"
          size="large"
        />
      </div>
    );
  }
  
  // Mostrar interfaz normal de login con transición suave
  const hasGradient = Boolean(systemConfig.gradientStartColor && systemConfig.gradientEndColor);
  const backgroundStyle = hasGradient ? {
    background: `${systemConfig.backgroundImageUrl ? `url('${systemConfig.backgroundImageUrl}'), ` : ''}linear-gradient(${systemConfig.gradientDirection}, ${systemConfig.gradientStartColor} 0%, ${systemConfig.gradientEndColor} 100%)`,
    backgroundSize: systemConfig.backgroundImageUrl ? `${systemConfig.backgroundSize}, cover` : 'cover',
    backgroundRepeat: systemConfig.backgroundImageUrl ? `${systemConfig.backgroundRepeat}, no-repeat` : 'no-repeat',
    backgroundPosition: systemConfig.backgroundImageUrl ? `${systemConfig.backgroundPosition}, center` : 'center'
  } : {};
  
  return (
    <div 
      className={`flex flex-col min-h-screen text-white transition-opacity duration-300 ${isLoadingConfig ? 'opacity-0' : 'opacity-100'}`}
      style={Object.keys(backgroundStyle).length > 0 ? backgroundStyle : { backgroundColor: '#f3f4f6' }}>
      
      {/* Header */}
      <header 
        className="shadow-md"
        style={{ 
          backgroundColor: systemConfig.headerBackgroundColor,
          color: systemConfig.headerTextColor 
        }}
      >
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          {systemConfig.headerLogoImageUrl && (
            <img 
              src={systemConfig.headerLogoImageUrl} 
              alt="Logo" 
              className="object-contain"
              style={{ height: `${systemConfig.headerLogoSize}px` }}
            />
          )}
          {!systemConfig.headerLogoImageUrl && (
            <div className="text-lg font-bold" style={{ color: systemConfig.headerTextColor }}>
              {systemConfig.loginTitle}
            </div>
          )}
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
              {/* Imagen de logo personalizable */}
              {systemConfig.loginLogoImageUrl && (
                <div className="relative my-3">
                  <img 
                    src={systemConfig.loginLogoImageUrl} 
                    alt="Logo" 
                    className="w-24 h-24 object-contain animate-pulse"
                  />
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-3/4 h-1 bg-yellow-300/20 rounded-full blur-md"></div>
                </div>
              )}
              
              {/* Mostrar título cuando no hay imagen */}
              {!systemConfig.loginLogoImageUrl && (
                <div className="my-3 text-center">
                  <h1 className="text-3xl font-bold text-gray-800 mb-2">{systemConfig.loginTitle}</h1>
                </div>
              )}
              
              <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">{systemConfig.loginSubtitle}</h2>
              <p className="text-gray-600 text-center max-w-xs">
                {lastDocument 
                  ? systemConfig.loginWelcomeText 
                  : systemConfig.loginWelcomeText
                }
              </p>
            </div>
            
            {lastDocument ? (
              <div className="space-y-5 mb-4">
                <div className="bg-gray-50/80 p-5 rounded-lg border border-gray-100 text-center shadow-sm">
                  <div className="text-sm text-gray-500 mb-1">Documento guardado</div>
                  <div className="text-xl font-medium text-gray-800">{lastDocument}</div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={() => {
                      setDocumentNumber(lastDocument);
                      performLogin(lastDocument);
                    }}
                    className="w-full py-6 text-base"
                    disabled={isLoading}
                  >
                    {systemConfig.loginButtonText}
                    {isLoading && <BrainLoader size="small" className="ml-2" />}
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={handleChangeUser}
                    className="w-full py-6 text-base"
                  >
                    Cambiar Usuario
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <label htmlFor="document-number" className="block text-base font-medium text-gray-700">
                    {systemConfig.loginDocumentLabel}
                  </label>
                  <Input
                    id="document-number"
                    type="text"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    placeholder="Ingresa tu cédula"
                    className="w-full py-6 text-lg bg-white/80"
                    required
                    disabled={isLoading}
                    autoComplete="off"
                  />
                </div>
                
                <Button 
                  type="submit"
                  className="w-full flex items-center justify-center py-6 text-base mt-8"
                  disabled={isLoading}
                >
                  <span>{isLoading ? "Iniciando sesión..." : systemConfig.loginButtonText}</span>
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
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;