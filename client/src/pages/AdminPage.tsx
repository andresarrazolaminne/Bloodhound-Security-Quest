import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { redeemPrize } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import RichTextEditor from "@/components/RichTextEditor";
import HtmlContent from "@/components/HtmlContent";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Loader2, 
  PlusCircle, 
  Pencil, 
  Trash2, 
  ExternalLink, 
  Download, 
  AlertTriangle, 
  LogOut,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  BarChart
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { MapSegmentAsset } from "@shared/schema";
import QRGenerator from '@/tools/QRGenerator';
import AnalyticsTab from '@/components/AnalyticsTab';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface MapAssetFormData {
  segmentId: number;
  imageUrl: string;
  redirectUrl: string;
  title: string;
  description: string;
  securityCode: string;
  isTrap: boolean;
  trapMessage: string;
  modalContent: string;
  generateNewCode?: boolean;
}

const AdminPage = () => {
  // Redención de premios
  const [redemptionCode, setRedemptionCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    redeemedAt?: string;
    alreadyRedeemed?: boolean;
  } | null>(null);

  // Gestión de segmentos del mapa
  const [mapAssets, setMapAssets] = useState<MapSegmentAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [seedingData, setSeedingData] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<MapSegmentAsset | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [systemConfig, setSystemConfig] = useState({
    instructionsText: "",
    siteMapImageUrl: "",
    footerLogoUrl: "",
    cobrandingImageUrl: "",
    mapGapSize: "medium" as 'none' | 'x-small' | 'small' | 'medium' | 'large',
    mapGridSize: "3x3" as '3x3' | '3x2' | '2x3' | '4x2' | '2x4',
    // Frontend customization fields
    appTitle: "",
    backgroundImageUrl: "",
    backgroundSize: "auto" as 'auto' | 'cover' | 'contain' | '100%' | '50%',
    backgroundRepeat: "repeat" as 'repeat' | 'no-repeat' | 'repeat-x' | 'repeat-y',
    backgroundPosition: "center" as 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top left' | 'top right' | 'bottom left' | 'bottom right',
    gradientStartColor: "#bb2558",
    gradientEndColor: "#e8cf00",
    gradientMidColor: "",
    gradientDirection: "175deg",
    gradientType: "linear" as 'linear' | 'radial',
    // Login page customization
    loginTitle: "Lanzamiento",
    loginSubtitle: "2025",
    loginWelcomeText: "Bienvenido al reto de identificación de riesgos",
    loginButtonText: "Ingresar",
    loginDocumentLabel: "Número de documento",
    loginNameLabel: "Nombre completo",
    loginLogoImageUrl: "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png",
    preloadImageUrl: "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png",
    scanButtonText: "",
    helpButtonText: "",
    siteMapButtonText: "",
    prizeButtonText: "",
    completionTitle: "",
    loadingText: ""
  });
  
  // Ranking de usuarios
  const [userRanking, setUserRanking] = useState<Array<{
    user: { id: number; documentNumber: string; name: string; completedAt: string | null };
    segments: Array<{ id: number; userId: number; segmentId: number; unlocked: boolean }>;
    totalSegments: number;
    unlockedSegments: number;
    completionPercentage: number;
    prize: { id: number; userId: number; redeemed: boolean; redemptionCode: string | null; redeemedAt: string | null } | null;
  }>>([]);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [documentFilter, setDocumentFilter] = useState("");
  const [filteredRanking, setFilteredRanking] = useState<typeof userRanking>([]);
  const [resettingData, setResettingData] = useState(false);
  const [formData, setFormData] = useState<MapAssetFormData>({
    segmentId: 1,
    imageUrl: "",
    redirectUrl: "",
    title: "",
    description: "",
    securityCode: "",
    isTrap: false,
    trapMessage: "",
    modalContent: "",
    generateNewCode: false
  });
  
  const [segmentFilter, setSegmentFilter] = useState<"all" | "normal" | "trap">("all");

  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Función para cerrar sesión
  const handleLogout = () => {
    // Eliminar la autenticación de la sesión
    sessionStorage.removeItem("adminAuthenticated");

    toast({
      title: "Sesión cerrada",
      description: "Has salido del panel de administración",
    });

    // Redirigir a la página de login
    setLocation("/admin-login");
  };

  // Función para cargar la configuración del sistema
  const fetchSystemConfig = async () => {
    try {
      const response = await apiRequest("GET", "/api/system-config");
      const data = await response.json();
      
      // La respuesta contiene un objeto 'config' que contiene la configuración
      const config = data.config || {};
      
      // Establecer la configuración actual
      setSystemConfig({
        instructionsText: config.instructionsText || "",
        siteMapImageUrl: config.siteMapImageUrl || "",
        footerLogoUrl: config.footerLogoUrl || "https://deuouqyoujoig.cloudfront.net/uploads/2025/QRCODEQUEST-IMAGENES-RETO/Pata_de_logos_negro.png",
        cobrandingImageUrl: config.cobrandingImageUrl || "https://deuouqyoujoig.cloudfront.net/uploads/2025/QRCODEQUEST-IMAGENES-RETO/Cobranding_actualizado.png",
        mapGapSize: config.mapGapSize || "medium",
        mapGridSize: config.mapGridSize || "3x3",
        // Frontend customization fields
        appTitle: config.appTitle || "Lanzamiento 2025",
        backgroundImageUrl: config.backgroundImageUrl || "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Textura-fondo-pagina.png",
        backgroundSize: config.backgroundSize || "auto",
        backgroundRepeat: config.backgroundRepeat || "repeat",
        backgroundPosition: config.backgroundPosition || "center",
        gradientStartColor: config.gradientStartColor || "#bb2558",
        gradientEndColor: config.gradientEndColor || "#e8cf00",
        gradientMidColor: config.gradientMidColor || "",
        gradientDirection: config.gradientDirection || "175deg",
        gradientType: config.gradientType || "linear",
        scanButtonText: config.scanButtonText || "¡Escanea aquí!",
        helpButtonText: config.helpButtonText || "Ayuda",
        siteMapButtonText: config.siteMapButtonText || "Mapa del Sitio",
        prizeButtonText: config.prizeButtonText || "Ver Código Premio",
        completionTitle: config.completionTitle || "¡Felicidades, has completado el reto!",
        loadingText: config.loadingText || "Cargando tu mapa...",
        loginTitle: config.loginTitle || "Lanzamiento",
        loginSubtitle: config.loginSubtitle || "2025",
        loginWelcomeText: config.loginWelcomeText || "Bienvenido al reto de identificación de riesgos",
        loginButtonText: config.loginButtonText || "Ingresar",
        loginDocumentLabel: config.loginDocumentLabel || "Número de documento",
        loginNameLabel: config.loginNameLabel || "Nombre completo",
        loginLogoImageUrl: config.loginLogoImageUrl || "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png",
        preloadImageUrl: config.preloadImageUrl || "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png"
      } as any);
    } catch (error) {
      console.error("Error loading system config:", error);
      // No mostramos un toast para no molestar al usuario si no hay config
    }
  };

  // Función para cargar datos del ranking de usuarios
  const fetchUserRanking = async () => {
    try {
      setLoadingRanking(true);
      const response = await apiRequest("GET", "/api/admin/users-progress");
      const data = await response.json();
      setUserRanking(data.users || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar el ranking de usuarios",
        variant: "destructive"
      });
    } finally {
      setLoadingRanking(false);
    }
  };

  // Función para actualizar la configuración del sistema
  const handleUpdateSystemConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoadingAssets(true);
      
      const response = await apiRequest("POST", "/api/admin/system-config", systemConfig);
      
      if (response.ok) {
        const data = await response.json();
        
        toast({
          title: "Configuración actualizada",
          description: "La personalización del frontend se ha guardado correctamente"
        });
        
        // Apply CSS custom properties immediately to prevent flash
        const timestamp = Date.now();
        document.documentElement.style.setProperty('--background-image-url', data.config.backgroundImageUrl ? `url('${data.config.backgroundImageUrl}?t=${timestamp}')` : '');
        document.documentElement.style.setProperty('--background-size', data.config.backgroundSize || 'auto');
        document.documentElement.style.setProperty('--background-repeat', data.config.backgroundRepeat || 'repeat');
        document.documentElement.style.setProperty('--background-position', data.config.backgroundPosition || 'center');
        document.documentElement.style.setProperty('--gradient-start-color', data.config.gradientStartColor || '#bb2558');
        document.documentElement.style.setProperty('--gradient-mid-color', data.config.gradientMidColor || '');
        document.documentElement.style.setProperty('--gradient-end-color', data.config.gradientEndColor || '#e8cf00');
        document.documentElement.style.setProperty('--gradient-direction', data.config.gradientDirection || '175deg');
        document.documentElement.style.setProperty('--gradient-type', data.config.gradientType || 'linear');
        
        // Emit custom event to notify other components about the configuration update
        window.dispatchEvent(new CustomEvent('systemConfigUpdated'));
        
        // Actualizar el estado local con los datos guardados
        if (data.config) {
          setSystemConfig({
            instructionsText: data.config.instructionsText || "",
            siteMapImageUrl: data.config.siteMapImageUrl || "",
            footerLogoUrl: data.config.footerLogoUrl || "https://deuouqyoujoig.cloudfront.net/uploads/2025/QRCODEQUEST-IMAGENES-RETO/Pata_de_logos_negro.png",
            cobrandingImageUrl: data.config.cobrandingImageUrl || "https://deuouqyoujoig.cloudfront.net/uploads/2025/QRCODEQUEST-IMAGENES-RETO/Cobranding_actualizado.png",
            mapGapSize: data.config.mapGapSize || "medium",
            mapGridSize: data.config.mapGridSize || "3x3",
            appTitle: data.config.appTitle || "Lanzamiento 2025",
            backgroundImageUrl: data.config.backgroundImageUrl || "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Textura-fondo-pagina.png",
            backgroundSize: data.config.backgroundSize || "auto",
            backgroundRepeat: data.config.backgroundRepeat || "repeat",
            backgroundPosition: data.config.backgroundPosition || "center",
            gradientStartColor: data.config.gradientStartColor || "#bb2558",
            gradientEndColor: data.config.gradientEndColor || "#e8cf00",
            gradientMidColor: data.config.gradientMidColor || "",
            gradientDirection: data.config.gradientDirection || "175deg",
            gradientType: data.config.gradientType || "linear",
            scanButtonText: data.config.scanButtonText || "¡Escanea aquí!",
            helpButtonText: data.config.helpButtonText || "Ayuda",
            siteMapButtonText: data.config.siteMapButtonText || "Mapa del Sitio",
            prizeButtonText: data.config.prizeButtonText || "Ver Código Premio",
            completionTitle: data.config.completionTitle || "¡Felicidades, has completado el reto!",
            loadingText: data.config.loadingText || "Cargando tu mapa...",
            loginTitle: data.config.loginTitle || "Lanzamiento",
            loginSubtitle: data.config.loginSubtitle || "2025",
            loginWelcomeText: data.config.loginWelcomeText || "Bienvenido al reto de identificación de riesgos",
            loginButtonText: data.config.loginButtonText || "Ingresar",
            loginDocumentLabel: data.config.loginDocumentLabel || "Número de documento",
            loginNameLabel: data.config.loginNameLabel || "Nombre completo",
            loginLogoImageUrl: data.config.loginLogoImageUrl || "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png",
            preloadImageUrl: data.config.preloadImageUrl || "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png"
          } as any);
        }
        
        // También recargar la configuración para asegurar sincronización
        await fetchSystemConfig();
      } else {
        throw new Error("Error al actualizar la configuración");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al actualizar la configuración del sistema",
        variant: "destructive"
      });
    } finally {
      setLoadingAssets(false);
    }
  };

  // Cargar assets de segmentos del mapa y configuración del sistema al iniciar
  useEffect(() => {
    fetchMapAssets();
    fetchSystemConfig();
    fetchUserRanking();
  }, []);
  
  // Filtrar los usuarios cuando cambia el filtro o los datos
  useEffect(() => {
    if (documentFilter.trim() === '') {
      setFilteredRanking(userRanking);
    } else {
      setFilteredRanking(
        userRanking.filter(item => 
          item.user.documentNumber.toLowerCase().includes(documentFilter.toLowerCase()) ||
          item.user.name.toLowerCase().includes(documentFilter.toLowerCase())
        )
      );
    }
  }, [userRanking, documentFilter]);

  // Función para cargar los assets de segmentos del mapa
  const fetchMapAssets = async () => {
    try {
      setLoadingAssets(true);
      const response = await apiRequest("GET", "/api/admin/map-assets");
      const data = await response.json();
      setMapAssets(data.assets);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar los segmentos del mapa",
        variant: "destructive"
      });
    } finally {
      setLoadingAssets(false);
    }
  };

  // Función para abrir el diálogo de crear asset
  const handleCreateAsset = () => {
    setDialogMode("create");
    setFormData({
      segmentId: 1,
      imageUrl: "",
      redirectUrl: "",
      title: "",
      description: "",
      securityCode: "",
      isTrap: false,
      trapMessage: "",
      modalContent: "",
      generateNewCode: true
    });
    setDialogOpen(true);
  };

  // Función para abrir el diálogo de editar asset
  const handleEditAsset = (asset: MapSegmentAsset) => {
    setDialogMode("edit");
    setSelectedAsset(asset);
    setFormData({
      segmentId: asset.segmentId,
      imageUrl: asset.imageUrl,
      redirectUrl: asset.redirectUrl || "",
      title: asset.title,
      description: asset.description || "",
      securityCode: asset.securityCode || "",
      isTrap: asset.isTrap || false,
      trapMessage: (asset as any).trapMessage || "",
      modalContent: (asset as any).modalContent || "",
      generateNewCode: false
    });
    setDialogOpen(true);
  };

  // Función para guardar un asset (crear o actualizar)
  const handleSaveAsset = async () => {
    try {
      setLoadingAssets(true);

      const payload = {
        ...formData,
        redirectUrl: formData.redirectUrl || null,
        description: formData.description || null,
        // Si el usuario eligió generar un nuevo código, incluimos la bandera
        // para que el servidor genere uno nuevo
        generateNewCode: formData.generateNewCode || false
      };

      if (dialogMode === "create") {
        // Crear nuevo asset
        await apiRequest("POST", "/api/admin/map-assets", payload);
        toast({
          title: "Éxito",
          description: "Segmento creado correctamente"
        });
      } else {
        // Actualizar asset existente
        await apiRequest("PUT", `/api/admin/map-assets/${formData.segmentId}`, payload);
        toast({
          title: "Éxito",
          description: "Segmento actualizado correctamente"
        });
      }

      // Recargar la lista de assets
      fetchMapAssets();
      setDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al guardar el segmento",
        variant: "destructive"
      });
    } finally {
      setLoadingAssets(false);
    }
  };

  // Función para eliminar un asset
  const handleDeleteAsset = async (segmentId: number) => {
    if (!confirm("¿Estás seguro de eliminar este segmento?")) {
      return;
    }

    try {
      setLoadingAssets(true);
      await apiRequest("DELETE", `/api/admin/map-assets/${segmentId}`);

      toast({
        title: "Éxito",
        description: "Segmento eliminado correctamente"
      });

      // Recargar la lista de assets
      fetchMapAssets();
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al eliminar el segmento",
        variant: "destructive"
      });
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!redemptionCode.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un código de redención",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      setResult(null);

      const response = await redeemPrize(redemptionCode);

      setResult({
        success: true,
        message: "Premio disponible para redención"
      });

      toast({
        title: "Éxito",
        description: "Premio validado correctamente",
      });

    } catch (error) {
      const errorResponse = await (error as Response).json();

      if (errorResponse.redeemedAt) {
        // Already redeemed - Mostrar como validado pero ya reclamado
        setResult({
          success: true, // Cambio a true para mostrar como válido pero ya reclamado
          message: "Premio ya reclamado anteriormente",
          redeemedAt: errorResponse.redeemedAt,
          alreadyRedeemed: true // Nuevo flag para indicar que ya fue reclamado
        });
      } else {
        // Invalid code or other error
        setResult({
          success: false,
          message: errorResponse.message || "Código de redención inválido"
        });
      }

      toast({
        title: "Error",
        description: errorResponse.message || "Código de redención inválido",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex justify-between items-center mb-6 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold">Panel de Administración</h1>
        <Button 
          variant="outline" 
          onClick={handleLogout}
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Cerrar Sesión
        </Button>
      </div>

      <Tabs defaultValue="prizes" className="max-w-5xl mx-auto">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-7 mb-6">
          <TabsTrigger value="prizes">Validación de Premios</TabsTrigger>
          <TabsTrigger value="segments">Segmentos del Mapa</TabsTrigger>
          <TabsTrigger value="qrgenerator">Generador de QR</TabsTrigger>
          <TabsTrigger value="ranking">Ranking de Usuarios</TabsTrigger>
          <TabsTrigger value="analytics">
            <div className="flex items-center gap-1">
              <BarChart className="h-4 w-4" />
              <span>Analíticas</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="frontend">Personalización</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="prizes">
          <Card className="w-full">
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-xl">Validación de Premios</CardTitle>
              <CardDescription className="text-white/80">
                Ingresa un código de redención para validar un premio
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="redemption-code" className="block text-sm font-medium text-gray-700">
                    Código de Redención
                  </label>
                  <Input
                    id="redemption-code"
                    type="text"
                    value={redemptionCode}
                    onChange={(e) => setRedemptionCode(e.target.value)}
                    placeholder="Ingresa el código de redención"
                    className="w-full"
                    required
                  />
                </div>

                <Button 
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Validando..." : "Validar Premio"}
                </Button>
              </form>

              {result && (
                <div className={`mt-6 p-4 rounded-md ${result.success ? (result.alreadyRedeemed ? 'bg-yellow-50' : 'bg-green-50') : 'bg-red-50'}`}>
                  <div className="flex items-center mb-2">
                    <Badge 
                      variant={result.success 
                        ? (result.alreadyRedeemed ? "secondary" : "success") 
                        : "destructive"} 
                      className="mr-2"
                    >
                      {result.success 
                        ? (result.alreadyRedeemed ? "Ya Reclamado" : "Válido") 
                        : "Inválido"}
                    </Badge>
                    <p className="font-medium">{result.message}</p>
                  </div>

                  {/* Mostrar el código de redención validado */}
                  {result.success && redemptionCode && (
                    <div className="my-3 p-3 bg-white border border-gray-200 rounded-md">
                      <p className="text-xs text-gray-500 mb-1">Código validado:</p>
                      <p className="font-mono text-lg font-bold tracking-wider break-all">
                        {redemptionCode}
                      </p>
                    </div>
                  )}

                  {result.redeemedAt && (
                    <div className="mt-2 mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="flex items-center text-yellow-800">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        <p className="font-medium">Premio ya entregado</p>
                      </div>
                      <p className="text-sm text-yellow-700 mt-1">
                        Código reclamado el: {new Date(result.redeemedAt).toLocaleString()}
                      </p>
                    </div>
                  )}

                  {/* El botón de confirmar entrega ha sido eliminado ya que es redundante */}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="segments">
          <Card className="w-full">
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-xl">Gestión de Segmentos del Mapa</CardTitle>
              <CardDescription className="text-white/80">
                Administra las imágenes y URLs de redirección de los segmentos del mapa
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="flex justify-between mb-6">
                <Button 
                  onClick={async () => {
                    try {
                      setSeedingData(true);

                      const response = await apiRequest("POST", "/api/admin/seed-map-assets");
                      const data = await response.json();

                      if (data.success) {
                        toast({
                          title: "Éxito",
                          description: "Segmentos predeterminados cargados correctamente",
                        });
                        fetchMapAssets();
                      }
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Error al cargar los segmentos predeterminados",
                        variant: "destructive"
                      });
                    } finally {
                      setSeedingData(false);
                    }
                  }}
                  variant="outline"
                  disabled={seedingData}
                >
                  {seedingData ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cargando...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Cargar Ejemplos
                    </>
                  )}
                </Button>

                <Button onClick={handleCreateAsset}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nuevo Segmento
                </Button>
              </div>

              {/* Estadísticas y filtro de QR */}
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-gray-50 p-4 rounded-lg">
                <div className="flex gap-4 items-center">
                  <div className="text-sm text-gray-600">
                    Total: <span className="font-semibold">{mapAssets.length}</span>
                  </div>
                  <div className="text-sm text-green-600">
                    ✅ Normales: <span className="font-semibold">{mapAssets.filter(a => !a.isTrap).length}</span>
                  </div>
                  <div className="text-sm text-orange-600">
                    🎯 Trampa: <span className="font-semibold">{mapAssets.filter(a => a.isTrap).length}</span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <select
                    value={segmentFilter}
                    onChange={(e) => setSegmentFilter(e.target.value as "all" | "normal" | "trap")}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Todos los QR</option>
                    <option value="normal">Solo QR Normales</option>
                    <option value="trap">Solo QR Trampa</option>
                  </select>
                </div>
              </div>

              {loadingAssets ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : mapAssets.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <p>No hay segmentos configurados</p>
                  <p className="text-sm mt-2">Haz clic en "Nuevo Segmento" para empezar</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {mapAssets
                    .filter(asset => {
                      if (segmentFilter === "normal") return !asset.isTrap;
                      if (segmentFilter === "trap") return asset.isTrap;
                      return true; // "all"
                    })
                    .map((asset) => (
                    <Card key={asset.id} className="overflow-hidden">
                      <div className="relative aspect-square">
                        <img 
                          src={asset.imageUrl} 
                          alt={`Segmento ${asset.segmentId}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://placehold.co/400x400/e2e8f0/64748b?text=Imagen+no+disponible";
                          }}
                        />
                        <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                          Segmento {asset.segmentId}
                        </div>
                        {asset.isTrap && (
                          <div className="absolute top-2 left-2 bg-orange-500 text-white px-2 py-1 rounded text-xs font-semibold">
                            🎯 TRAMPA
                          </div>
                        )}
                      </div>

                      <CardContent className="p-4">
                        <h3 className="font-bold truncate">{asset.title || `Segmento ${asset.segmentId}`}</h3>

                        {asset.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{asset.description}</p>
                        )}

                        {asset.redirectUrl && (
                          <div className="flex items-center mt-2 text-sm text-blue-600">
                            <ExternalLink className="h-4 w-4 mr-1" />
                            <span className="truncate">{asset.redirectUrl}</span>
                          </div>
                        )}

                        {asset.securityCode && (
                          <div className="flex items-center mt-2 text-xs text-gray-600 bg-gray-100 p-1 rounded">
                            <span className="font-mono font-semibold tracking-wider mr-1">
                              Código: {asset.securityCode}
                            </span>
                          </div>
                        )}

                        {/* Indicador de tipo de QR */}
                        <div className="flex items-center mt-2">
                          {asset.isTrap ? (
                            <div className="flex items-center text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                              <span className="mr-1">🎯</span>
                              <span className="font-semibold">QR Trampa</span>
                            </div>
                          ) : (
                            <div className="flex items-center text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                              <span className="mr-1">✅</span>
                              <span className="font-semibold">QR Normal</span>
                            </div>
                          )}
                        </div>
                      </CardContent>

                      <CardFooter className="flex justify-between p-4 pt-0">
                        <Button variant="outline" size="sm" onClick={() => handleEditAsset(asset)}>
                          <Pencil className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDeleteAsset(asset.segmentId)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Eliminar
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qrgenerator">
          <Card className="w-full">
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-xl">Generador de Códigos QR</CardTitle>
              <CardDescription className="text-white/80">
                Crea códigos QR para el desbloqueo de segmentos del mapa
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <QRGenerator />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <Card className="w-full">
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-xl">Configuración del Sistema</CardTitle>
              <CardDescription className="text-white/80">
                Gestiona las configuraciones globales de la aplicación
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6">
              <form className="space-y-6" onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await apiRequest("POST", "/api/admin/system-config", {
                    instructionsText: systemConfig.instructionsText,
                    siteMapImageUrl: systemConfig.siteMapImageUrl,
                    footerLogoUrl: systemConfig.footerLogoUrl,
                    cobrandingImageUrl: systemConfig.cobrandingImageUrl,
                    mapGapSize: systemConfig.mapGapSize,
                    mapGridSize: systemConfig.mapGridSize
                  });
                  
                  toast({
                    title: "Éxito",
                    description: "Configuración actualizada correctamente"
                  });
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "No se pudo actualizar la configuración",
                    variant: "destructive"
                  });
                }
              }}>
                <div className="space-y-2">
                  <label htmlFor="instructions" className="block text-sm font-medium text-gray-700">
                    Texto de Instrucciones
                  </label>
                  
                  <RichTextEditor
                    value={systemConfig.instructionsText}
                    onChange={(value) => setSystemConfig({
                      ...systemConfig,
                      instructionsText: value
                    })}
                    className="min-h-[300px]"
                  />
                  
                  <p className="text-sm text-gray-500">
                    Este texto se mostrará en el modal de instrucciones. 
                    Usa el editor para dar formato a las instrucciones.
                  </p>
                  
                  {systemConfig.instructionsText && (
                    <div className="mt-4 border rounded-md p-4">
                      <p className="text-sm font-medium mb-2">Vista previa:</p>
                      <HtmlContent html={systemConfig.instructionsText} />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="map-url" className="block text-sm font-medium text-gray-700">
                    URL del Mapa del Sitio
                  </label>
                  <Input
                    id="map-url"
                    type="url"
                    value={systemConfig.siteMapImageUrl}
                    onChange={(e) => setSystemConfig({
                      ...systemConfig,
                      siteMapImageUrl: e.target.value
                    })}
                    placeholder="https://ejemplo.com/mapa.jpg"
                  />
                  <p className="text-sm text-gray-500">
                    URL de la imagen del mapa del sitio que se mostrará en el modal correspondiente
                  </p>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="footer-logo-url" className="block text-sm font-medium text-gray-700">
                    URL del Logo del Pie de Página
                  </label>
                  <Input
                    id="footer-logo-url"
                    type="url"
                    value={systemConfig.footerLogoUrl}
                    onChange={(e) => setSystemConfig({
                      ...systemConfig,
                      footerLogoUrl: e.target.value
                    })}
                    placeholder="https://ejemplo.com/logos.png"
                  />
                  <p className="text-sm text-gray-500">
                    URL de la imagen con los logos de patrocinadores que se mostrará en el pie de página
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="cobranding-image-url" className="block text-sm font-medium text-gray-700">
                    URL de la Imagen de Cobranding
                  </label>
                  <Input
                    id="cobranding-image-url"
                    type="url"
                    value={systemConfig.cobrandingImageUrl}
                    onChange={(e) => setSystemConfig({
                      ...systemConfig,
                      cobrandingImageUrl: e.target.value
                    })}
                    placeholder="https://ejemplo.com/cobranding.png"
                  />
                  <p className="text-sm text-gray-500">
                    URL de la imagen de cobranding que se mostrará en el encabezado de la aplicación
                  </p>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="map-gap-size" className="block text-sm font-medium text-gray-700">
                    Espaciado entre Imágenes del Mapa
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Button
                      type="button"
                      variant={systemConfig.mapGapSize === 'none' ? 'default' : 'outline'}
                      className="flex flex-col items-center py-3"
                      onClick={() => setSystemConfig({
                        ...systemConfig,
                        mapGapSize: 'none'
                      })}
                    >
                      <div className="flex items-center gap-0 mb-1">
                        <div className="w-3 h-3 bg-primary rounded-sm"></div>
                        <div className="w-3 h-3 bg-primary rounded-sm"></div>
                      </div>
                      <span className="text-xs">Sin Separación</span>
                    </Button>
                    
                    <Button
                      type="button"
                      variant={systemConfig.mapGapSize === 'x-small' ? 'default' : 'outline'}
                      className="flex flex-col items-center py-3"
                      onClick={() => setSystemConfig({
                        ...systemConfig,
                        mapGapSize: 'x-small'
                      })}
                    >
                      <div className="flex items-center gap-[2px] mb-1">
                        <div className="w-3 h-3 bg-primary rounded"></div>
                        <div className="w-3 h-3 bg-primary rounded"></div>
                      </div>
                      <span className="text-xs">Mínimo</span>
                    </Button>
                    
                    <Button
                      type="button"
                      variant={systemConfig.mapGapSize === 'small' ? 'default' : 'outline'}
                      className="flex flex-col items-center py-3"
                      onClick={() => setSystemConfig({
                        ...systemConfig,
                        mapGapSize: 'small'
                      })}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <div className="w-3 h-3 bg-primary rounded"></div>
                        <div className="w-3 h-3 bg-primary rounded"></div>
                      </div>
                      <span className="text-xs">Pequeño</span>
                    </Button>
                    
                    <Button
                      type="button"
                      variant={systemConfig.mapGapSize === 'medium' ? 'default' : 'outline'}
                      className="flex flex-col items-center py-3"
                      onClick={() => setSystemConfig({
                        ...systemConfig,
                        mapGapSize: 'medium'
                      })}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 bg-primary rounded"></div>
                        <div className="w-3 h-3 bg-primary rounded"></div>
                      </div>
                      <span className="text-xs">Medio</span>
                    </Button>
                    
                    <Button
                      type="button"
                      variant={systemConfig.mapGapSize === 'large' ? 'default' : 'outline'}
                      className="flex flex-col items-center py-3"
                      onClick={() => setSystemConfig({
                        ...systemConfig,
                        mapGapSize: 'large'
                      })}
                    >
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-3 h-3 bg-primary rounded"></div>
                        <div className="w-3 h-3 bg-primary rounded"></div>
                      </div>
                      <span className="text-xs">Grande</span>
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500">
                    Controla la separación entre las imágenes del mapa en la cuadrícula
                  </p>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="map-grid-size" className="block text-sm font-medium text-gray-700">
                    Tamaño de la Cuadrícula del Mapa
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Button
                      type="button"
                      variant={systemConfig.mapGridSize === '3x3' ? 'default' : 'outline'}
                      className="flex flex-col items-center py-3"
                      onClick={() => setSystemConfig({
                        ...systemConfig,
                        mapGridSize: '3x3'
                      })}
                    >
                      <div className="grid grid-cols-3 gap-[2px] mb-1">
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                      </div>
                      <span className="text-xs">3x3 (9 Imágenes)</span>
                    </Button>
                    
                    <Button
                      type="button"
                      variant={systemConfig.mapGridSize === '3x2' ? 'default' : 'outline'}
                      className="flex flex-col items-center py-3"
                      onClick={() => setSystemConfig({
                        ...systemConfig,
                        mapGridSize: '3x2'
                      })}
                    >
                      <div className="grid grid-cols-3 gap-[2px] mb-1">
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                      </div>
                      <span className="text-xs">3x2 (6 Imágenes)</span>
                    </Button>
                    
                    <Button
                      type="button"
                      variant={systemConfig.mapGridSize === '2x3' ? 'default' : 'outline'}
                      className="flex flex-col items-center py-3"
                      onClick={() => setSystemConfig({
                        ...systemConfig,
                        mapGridSize: '2x3'
                      })}
                    >
                      <div className="grid grid-cols-2 gap-[2px] mb-1">
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                      </div>
                      <span className="text-xs">2x3 (6 Imágenes)</span>
                    </Button>
                    
                    <Button
                      type="button"
                      variant={systemConfig.mapGridSize === '4x2' ? 'default' : 'outline'}
                      className="flex flex-col items-center py-3"
                      onClick={() => setSystemConfig({
                        ...systemConfig,
                        mapGridSize: '4x2'
                      })}
                    >
                      <div className="grid grid-cols-4 gap-[2px] mb-1">
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                      </div>
                      <span className="text-xs">4x2 (8 Imágenes)</span>
                    </Button>
                    
                    <Button
                      type="button"
                      variant={systemConfig.mapGridSize === '2x4' ? 'default' : 'outline'}
                      className="flex flex-col items-center py-3"
                      onClick={() => setSystemConfig({
                        ...systemConfig,
                        mapGridSize: '2x4'
                      })}
                    >
                      <div className="grid grid-cols-2 gap-[2px] mb-1">
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                        <div className="w-2 h-2 bg-primary rounded-sm"></div>
                      </div>
                      <span className="text-xs">2x4 (8 Imágenes)</span>
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500">
                    Selecciona el tamaño de la cuadrícula para el mapa (número de filas y columnas)
                  </p>
                </div>

                <Button type="submit" className="w-full">
                  Guardar Configuración
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranking">
          <Card className="w-full">
            <CardHeader className="bg-primary text-white">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl">Ranking de Usuarios</CardTitle>
                  <CardDescription className="text-white/80">
                    Consulta el progreso de los usuarios en la aplicación
                  </CardDescription>
                </div>
                <Button 
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    if (confirm("¿Estás seguro de reiniciar todos los datos de usuarios?\nEsta acción no se puede deshacer.")) {
                      try {
                        setResettingData(true);
                        const response = await apiRequest("POST", "/api/admin/reset-data");
                        const data = await response.json();
                        
                        toast({
                          title: "Datos reiniciados",
                          description: "Todos los datos de usuarios han sido eliminados"
                        });
                        
                        // Recargar el ranking
                        fetchUserRanking();
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: "Error al reiniciar los datos",
                          variant: "destructive"
                        });
                      } finally {
                        setResettingData(false);
                      }
                    }
                  }}
                  disabled={resettingData}
                  className="text-white"
                >
                  {resettingData ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Reiniciando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reiniciar datos
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="mb-4">
                <Input
                  placeholder="Filtrar por Cédula o Nombre"
                  value={documentFilter}
                  onChange={(e) => setDocumentFilter(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead className="w-40">Documento</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="w-32 text-center">Progreso</TableHead>
                      <TableHead className="w-40 text-center">Fecha Logro</TableHead>
                      <TableHead className="w-32 text-center">Premio</TableHead>
                      <TableHead className="w-32 text-center">Segmentos</TableHead>
                      <TableHead className="w-32 text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingRanking ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        </TableCell>
                      </TableRow>
                    ) : filteredRanking.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-6 text-gray-500">
                          No hay usuarios registrados o que coincidan con el filtro
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRanking.map((item, index) => (
                        <TableRow key={item.user.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>{item.user.documentNumber}</TableCell>
                          <TableCell>{item.user.name}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center">
                              <Progress 
                                value={item.completionPercentage} 
                                className="w-20 h-2" 
                              />
                              <span className="ml-2 text-sm">
                                {Math.round(item.completionPercentage)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.user.completedAt ? (
                              <span className="text-sm">
                                {new Date(item.user.completedAt).toLocaleString('es-ES', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">No completado</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.completionPercentage === 100 ? (
                              item.prize && item.prize.redeemed ? (
                                <Badge variant="success" className="gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Reclamado
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  Pendiente
                                </Badge>
                              )
                            ) : (
                              <Badge variant="outline" className="gap-1">
                                <AlertCircle className="h-3.5 w-3.5" />
                                No disponible
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.unlockedSegments}/{item.totalSegments}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center">
                              {item.completionPercentage === 100 ? (
                                <Badge variant="success" className="gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Completado
                                </Badge>
                              ) : item.completionPercentage > 0 ? (
                                <Badge variant="secondary" className="gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  En progreso
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  Sin iniciar
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card className="w-full">
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-xl">Analíticas de Uso</CardTitle>
              <CardDescription className="text-white/80">
                Métricas y estadísticas de uso de la aplicación
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <AnalyticsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="frontend">
          <Card className="w-full">
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-xl">Personalización del Frontend</CardTitle>
              <CardDescription className="text-white/80">
                Personaliza títulos, textos de botones y elementos visuales de la aplicación
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Tabs defaultValue="customization" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="customization">Personalización</TabsTrigger>
                  <TabsTrigger value="images">Imágenes</TabsTrigger>
                  <TabsTrigger value="colors">Colores</TabsTrigger>
                  <TabsTrigger value="login">Página Login</TabsTrigger>
                </TabsList>

                <TabsContent value="customization" className="space-y-6">
                  <form onSubmit={handleUpdateSystemConfig} className="space-y-6">
                {/* Títulos y elementos principales */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Títulos Principales</h3>
                  
                  <div className="space-y-2">
                    <label htmlFor="app-title" className="block text-sm font-medium text-gray-700">
                      Título de la Aplicación
                    </label>
                    <Input
                      id="app-title"
                      value={systemConfig.appTitle}
                      onChange={(e) => setSystemConfig({
                        ...systemConfig,
                        appTitle: e.target.value
                      })}
                      placeholder="Lanzamiento 2025"
                    />
                    <p className="text-xs text-gray-500">
                      Texto que aparece en el encabezado de la aplicación (actualmente: "Lanzamiento 2025")
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="completion-title" className="block text-sm font-medium text-gray-700">
                      Título de Completación
                    </label>
                    <Input
                      id="completion-title"
                      value={systemConfig.completionTitle}
                      onChange={(e) => setSystemConfig({
                        ...systemConfig,
                        completionTitle: e.target.value
                      })}
                      placeholder="¡Felicidades, has completado el reto!"
                    />
                    <p className="text-xs text-gray-500">
                      Título que se muestra cuando el usuario completa todos los segmentos
                    </p>
                  </div>
                </div>

                {/* Textos de botones */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Textos de Botones</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="scan-button-text" className="block text-sm font-medium text-gray-700">
                        Texto del Botón de Escaneo
                      </label>
                      <Input
                        id="scan-button-text"
                        value={systemConfig.scanButtonText}
                        onChange={(e) => setSystemConfig({
                          ...systemConfig,
                          scanButtonText: e.target.value
                        })}
                        placeholder="¡Escanea aquí!"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="help-button-text" className="block text-sm font-medium text-gray-700">
                        Texto del Botón de Ayuda
                      </label>
                      <Input
                        id="help-button-text"
                        value={systemConfig.helpButtonText}
                        onChange={(e) => setSystemConfig({
                          ...systemConfig,
                          helpButtonText: e.target.value
                        })}
                        placeholder="Ayuda"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="sitemap-button-text" className="block text-sm font-medium text-gray-700">
                        Texto del Botón de Mapa del Sitio
                      </label>
                      <Input
                        id="sitemap-button-text"
                        value={systemConfig.siteMapButtonText}
                        onChange={(e) => setSystemConfig({
                          ...systemConfig,
                          siteMapButtonText: e.target.value
                        })}
                        placeholder="Mapa del Sitio"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="prize-button-text" className="block text-sm font-medium text-gray-700">
                        Texto del Botón de Premio
                      </label>
                      <Input
                        id="prize-button-text"
                        value={systemConfig.prizeButtonText}
                        onChange={(e) => setSystemConfig({
                          ...systemConfig,
                          prizeButtonText: e.target.value
                        })}
                        placeholder="Ver Código Premio"
                      />
                    </div>
                  </div>
                </div>

                {/* Mensajes y textos auxiliares */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Mensajes del Sistema</h3>
                  
                  <div className="space-y-2">
                    <label htmlFor="loading-text" className="block text-sm font-medium text-gray-700">
                      Texto de Carga
                    </label>
                    <Input
                      id="loading-text"
                      value={systemConfig.loadingText}
                      onChange={(e) => setSystemConfig({
                        ...systemConfig,
                        loadingText: e.target.value
                      })}
                      placeholder="Cargando tu mapa..."
                    />
                    <p className="text-xs text-gray-500">
                      Mensaje que se muestra mientras carga el mapa
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button type="submit" disabled={loadingAssets}>
                    {loadingAssets ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Actualizando...
                      </>
                    ) : (
                      "Actualizar Personalización"
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="images" className="space-y-6">
              <form onSubmit={handleUpdateSystemConfig} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Imágenes del Sistema</h3>
                  
                  <div className="space-y-2">
                    <label htmlFor="cobranding-image-url" className="block text-sm font-medium text-gray-700">
                      URL de Imagen del Banner (Cobranding)
                    </label>
                    <Input
                      id="cobranding-image-url"
                      type="url"
                      value={systemConfig.cobrandingImageUrl}
                      onChange={(e) => setSystemConfig({
                        ...systemConfig,
                        cobrandingImageUrl: e.target.value
                      })}
                      placeholder="https://ejemplo.com/banner.png"
                    />
                    <p className="text-xs text-gray-500">
                      Imagen que aparece en la parte superior del mapa (banner de marcas)
                    </p>
                    {systemConfig.cobrandingImageUrl && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-md">
                        <p className="text-xs text-gray-600 mb-2">Vista previa:</p>
                        <img 
                          src={systemConfig.cobrandingImageUrl} 
                          alt="Vista previa banner" 
                          className="h-12 object-contain border border-gray-200 rounded"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="footer-logo-url" className="block text-sm font-medium text-gray-700">
                      URL de Imagen del Footer (Logos de Patrocinadores)
                    </label>
                    <Input
                      id="footer-logo-url"
                      type="url"
                      value={systemConfig.footerLogoUrl}
                      onChange={(e) => setSystemConfig({
                        ...systemConfig,
                        footerLogoUrl: e.target.value
                      })}
                      placeholder="https://ejemplo.com/logos-footer.png"
                    />
                    <p className="text-xs text-gray-500">
                      Imagen con logos de patrocinadores que aparece en el pie de página
                    </p>
                    {systemConfig.footerLogoUrl && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-md">
                        <p className="text-xs text-gray-600 mb-2">Vista previa:</p>
                        <img 
                          src={systemConfig.footerLogoUrl} 
                          alt="Vista previa footer" 
                          className="max-h-16 object-contain border border-gray-200 rounded w-full"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="site-map-image-url" className="block text-sm font-medium text-gray-700">
                      URL de Imagen del Mapa del Sitio
                    </label>
                    <Input
                      id="site-map-image-url"
                      type="url"
                      value={systemConfig.siteMapImageUrl}
                      onChange={(e) => setSystemConfig({
                        ...systemConfig,
                        siteMapImageUrl: e.target.value
                      })}
                      placeholder="https://ejemplo.com/mapa-completo.png"
                    />
                    <p className="text-xs text-gray-500">
                      Imagen que se muestra en el modal "Mapa del Sitio"
                    </p>
                    {systemConfig.siteMapImageUrl && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-md">
                        <p className="text-xs text-gray-600 mb-2">Vista previa:</p>
                        <img 
                          src={systemConfig.siteMapImageUrl} 
                          alt="Vista previa mapa del sitio" 
                          className="max-h-20 object-contain border border-gray-200 rounded"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button type="submit" disabled={loadingAssets}>
                    {loadingAssets ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Actualizando...
                      </>
                    ) : (
                      "Actualizar Personalización"
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="images" className="space-y-6">
              <form onSubmit={handleUpdateSystemConfig} className="space-y-6">
                {/* Imágenes y fondos */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Gestión de Imágenes</h3>
                  

                  
                  <div className="space-y-2">
                    <label htmlFor="cobranding-image-url" className="block text-sm font-medium text-gray-700">
                      URL de Imagen del Banner (Cobranding)
                    </label>
                    <Input
                      id="cobranding-image-url"
                      type="url"
                      value={systemConfig.cobrandingImageUrl}
                      onChange={(e) => setSystemConfig({
                        ...systemConfig,
                        cobrandingImageUrl: e.target.value
                      })}
                      placeholder="https://ejemplo.com/banner.png"
                    />
                    <p className="text-xs text-gray-500">
                      Imagen que aparece en la parte superior del mapa (banner de marcas)
                    </p>
                    {systemConfig.cobrandingImageUrl && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-md">
                        <p className="text-xs text-gray-600 mb-2">Vista previa:</p>
                        <img 
                          src={systemConfig.cobrandingImageUrl} 
                          alt="Vista previa banner" 
                          className="h-12 object-contain border border-gray-200 rounded"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="footer-logo-url" className="block text-sm font-medium text-gray-700">
                      URL de Imagen del Footer (Logos de Patrocinadores)
                    </label>
                    <Input
                      id="footer-logo-url"
                      type="url"
                      value={systemConfig.footerLogoUrl}
                      onChange={(e) => setSystemConfig({
                        ...systemConfig,
                        footerLogoUrl: e.target.value
                      })}
                      placeholder="https://ejemplo.com/logos.png"
                    />
                    <p className="text-xs text-gray-500">
                      Logos de patrocinadores que aparecen en la parte inferior
                    </p>
                    {systemConfig.footerLogoUrl && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-md">
                        <p className="text-xs text-gray-600 mb-2">Vista previa:</p>
                        <img 
                          src={systemConfig.footerLogoUrl} 
                          alt="Vista previa footer" 
                          className="h-8 object-contain border border-gray-200 rounded"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="site-map-image-url" className="block text-sm font-medium text-gray-700">
                      URL de Imagen del Mapa del Sitio
                    </label>
                    <Input
                      id="site-map-image-url"
                      type="url"
                      value={systemConfig.siteMapImageUrl}
                      onChange={(e) => setSystemConfig({
                        ...systemConfig,
                        siteMapImageUrl: e.target.value
                      })}
                      placeholder="https://ejemplo.com/mapa.jpg"
                    />
                    <p className="text-xs text-gray-500">
                      Imagen que se muestra en el modal "Mapa del Sitio"
                    </p>
                    {systemConfig.siteMapImageUrl && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-md">
                        <p className="text-xs text-gray-600 mb-2">Vista previa:</p>
                        <img 
                          src={systemConfig.siteMapImageUrl} 
                          alt="Vista previa mapa del sitio" 
                          className="h-20 object-contain border border-gray-200 rounded"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="login-logo-image-url" className="block text-sm font-medium text-gray-700">
                      URL de Imagen/Logo del Login
                    </label>
                    <Input
                      id="login-logo-image-url"
                      type="url"
                      value={systemConfig.loginLogoImageUrl || 'https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png'}
                      onChange={(e) => setSystemConfig({
                        ...systemConfig,
                        loginLogoImageUrl: e.target.value
                      })}
                      placeholder="https://ejemplo.com/logo-login.png"
                    />
                    <p className="text-xs text-gray-500">
                      Imagen/logo que aparece en la página de login entre el título y subtítulo
                    </p>
                    {systemConfig.loginLogoImageUrl && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-md">
                        <p className="text-xs text-gray-600 mb-2">Vista previa:</p>
                        <img 
                          src={systemConfig.loginLogoImageUrl} 
                          alt="Vista previa logo login" 
                          className="h-16 object-contain border border-gray-200 rounded"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="header-logo-image-url" className="block text-sm font-medium text-gray-700">
                      URL de Logo del Header
                    </label>
                    <Input
                      id="header-logo-image-url"
                      type="url"
                      value={(systemConfig as any).headerLogoImageUrl || 'https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png'}
                      onChange={(e) => setSystemConfig({
                        ...systemConfig,
                        headerLogoImageUrl: e.target.value
                      } as any)}
                      placeholder="https://ejemplo.com/logo-header.png"
                    />
                    <p className="text-xs text-gray-500">
                      Logo que aparece en la parte superior izquierda del header de la aplicación (reemplaza el título)
                    </p>
                    {(systemConfig as any).headerLogoImageUrl && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-md">
                        <p className="text-xs text-gray-600 mb-2">Vista previa:</p>
                        <img 
                          src={(systemConfig as any).headerLogoImageUrl} 
                          alt="Vista previa logo header" 
                          className="h-8 object-contain border border-gray-200 rounded"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="preload-image-url" className="block text-sm font-medium text-gray-700">
                      URL de Imagen de Precarga
                    </label>
                    <Input
                      id="preload-image-url"
                      type="url"
                      value={systemConfig.preloadImageUrl || 'https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png'}
                      onChange={(e) => setSystemConfig({
                        ...systemConfig,
                        preloadImageUrl: e.target.value
                      })}
                      placeholder="https://ejemplo.com/imagen-carga.png"
                    />
                    <p className="text-xs text-gray-500">
                      Imagen que se muestra en las pantallas de carga y precarga de la aplicación
                    </p>
                    {systemConfig.preloadImageUrl && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-md">
                        <p className="text-xs text-gray-600 mb-2">Vista previa:</p>
                        <img 
                          src={systemConfig.preloadImageUrl} 
                          alt="Vista previa imagen precarga" 
                          className="h-16 object-contain border border-gray-200 rounded"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Actualizar Imágenes"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="colors" className="space-y-6">
              <form onSubmit={handleUpdateSystemConfig} className="space-y-6">
                {/* Configuración completa del fondo */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Configuración Completa del Fondo</h3>
                  
                  {/* URL de imagen de fondo */}
                  <div className="space-y-2">
                    <label htmlFor="background-image-url" className="block text-sm font-medium text-gray-700">
                      URL de Imagen de Fondo (Textura)
                    </label>
                    <Input
                      id="background-image-url"
                      type="url"
                      value={systemConfig.backgroundImageUrl}
                      onChange={(e) => setSystemConfig({
                        ...systemConfig,
                        backgroundImageUrl: e.target.value
                      })}
                      placeholder="https://ejemplo.com/fondo.png"
                    />
                    <p className="text-xs text-gray-500">
                      URL de la imagen de textura de fondo de la aplicación
                    </p>
                    {systemConfig.backgroundImageUrl && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-md">
                        <p className="text-xs text-gray-600 mb-2">Vista previa:</p>
                        <img 
                          src={systemConfig.backgroundImageUrl} 
                          alt="Vista previa fondo" 
                          className="h-16 w-32 object-cover border border-gray-200 rounded"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Configuración avanzada del degradado */}
                  <div className="space-y-4">
                    <h4 className="text-md font-semibold text-gray-800 border-b pb-2">Configuración del Degradado</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="gradient-type" className="block text-sm font-medium text-gray-700">
                          Tipo de Degradado
                        </label>
                        <select
                          id="gradient-type"
                          value={systemConfig.gradientType || 'linear'}
                          onChange={(e) => setSystemConfig({
                            ...systemConfig,
                            gradientType: e.target.value as 'linear' | 'radial'
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                        >
                          <option value="linear">Lineal</option>
                          <option value="radial">Radial</option>
                        </select>
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="gradient-direction" className="block text-sm font-medium text-gray-700">
                          Dirección/Ángulo
                        </label>
                        <Input
                          id="gradient-direction"
                          type="text"
                          value={systemConfig.gradientDirection || '175deg'}
                          onChange={(e) => setSystemConfig({
                            ...systemConfig,
                            gradientDirection: e.target.value
                          })}
                          placeholder="175deg, to right, 45deg"
                          className="w-full font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500">
                          Ej: 175deg, to right, to bottom left
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="gradient-start-color" className="block text-sm font-medium text-gray-700">
                          Color Inicial
                        </label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="gradient-start-color"
                            type="color"
                            value={systemConfig.gradientStartColor || '#bb2558'}
                            onChange={(e) => setSystemConfig({
                              ...systemConfig,
                              gradientStartColor: e.target.value
                            })}
                            className="w-16 h-10 rounded cursor-pointer border-2"
                          />
                          <Input
                            type="text"
                            value={systemConfig.gradientStartColor || '#bb2558'}
                            onChange={(e) => setSystemConfig({
                              ...systemConfig,
                              gradientStartColor: e.target.value
                            })}
                            placeholder="#bb2558"
                            className="flex-1 font-mono text-sm"
                          />
                        </div>
                      </div>
                    
                      <div className="space-y-2">
                        <label htmlFor="gradient-end-color" className="block text-sm font-medium text-gray-700">
                          Color Final
                        </label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="gradient-end-color"
                            type="color"
                            value={systemConfig.gradientEndColor || '#e8cf00'}
                            onChange={(e) => setSystemConfig({
                              ...systemConfig,
                              gradientEndColor: e.target.value
                            })}
                            className="w-16 h-10 rounded cursor-pointer border-2"
                          />
                          <Input
                            type="text"
                            value={systemConfig.gradientEndColor || '#e8cf00'}
                            onChange={(e) => setSystemConfig({
                              ...systemConfig,
                              gradientEndColor: e.target.value
                            })}
                            placeholder="#e8cf00"
                            className="flex-1 font-mono text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Color intermedio opcional */}
                    <div className="space-y-2">
                      <label htmlFor="gradient-mid-color" className="block text-sm font-medium text-gray-700">
                        Color Intermedio (Opcional)
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="gradient-mid-color"
                          type="color"
                          value={systemConfig.gradientMidColor || '#ffffff'}
                          onChange={(e) => setSystemConfig({
                            ...systemConfig,
                            gradientMidColor: e.target.value
                          })}
                          className="w-16 h-10 rounded cursor-pointer border-2"
                        />
                        <Input
                          type="text"
                          value={systemConfig.gradientMidColor || ''}
                          onChange={(e) => setSystemConfig({
                            ...systemConfig,
                            gradientMidColor: e.target.value
                          })}
                          placeholder="Dejar vacío para no usar"
                          className="flex-1 font-mono text-sm"
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        Agrega un color en el medio del degradado para más variación
                      </p>
                    </div>
                  </div>
                  
                  {/* Configuración del fondo */}
                  <div className="space-y-4">
                    <h4 className="text-md font-semibold text-gray-800 border-b pb-2">Configuración de Imagen de Fondo</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="background-size" className="block text-sm font-medium text-gray-700">
                          Tamaño
                        </label>
                        <select
                          id="background-size"
                          value={systemConfig.backgroundSize || 'auto'}
                          onChange={(e) => setSystemConfig({
                            ...systemConfig,
                            backgroundSize: e.target.value as 'auto' | 'cover' | 'contain' | '100%' | '50%'
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                        >
                          <option value="auto">Auto</option>
                          <option value="cover">Cubrir (cover)</option>
                          <option value="contain">Contener (contain)</option>
                          <option value="100%">100%</option>
                          <option value="50%">50%</option>
                        </select>
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="background-repeat" className="block text-sm font-medium text-gray-700">
                          Repetición
                        </label>
                        <select
                          id="background-repeat"
                          value={systemConfig.backgroundRepeat || 'repeat'}
                          onChange={(e) => setSystemConfig({
                            ...systemConfig,
                            backgroundRepeat: e.target.value as 'repeat' | 'no-repeat' | 'repeat-x' | 'repeat-y'
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                        >
                          <option value="repeat">Repetir</option>
                          <option value="no-repeat">No repetir</option>
                          <option value="repeat-x">Repetir horizontalmente</option>
                          <option value="repeat-y">Repetir verticalmente</option>
                        </select>
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="background-position" className="block text-sm font-medium text-gray-700">
                          Posición
                        </label>
                        <select
                          id="background-position"
                          value={systemConfig.backgroundPosition || 'center'}
                          onChange={(e) => setSystemConfig({
                            ...systemConfig,
                            backgroundPosition: e.target.value as 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top left' | 'top right' | 'bottom left' | 'bottom right'
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                        >
                          <option value="center">Centro</option>
                          <option value="top">Arriba</option>
                          <option value="bottom">Abajo</option>
                          <option value="left">Izquierda</option>
                          <option value="right">Derecha</option>
                          <option value="top left">Arriba izquierda</option>
                          <option value="top right">Arriba derecha</option>
                          <option value="bottom left">Abajo izquierda</option>
                          <option value="bottom right">Abajo derecha</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  {/* Vista previa del degradado */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Vista Previa del Degradado y Fondo
                    </label>
                    <div 
                      className="w-full h-20 rounded-lg border border-gray-200 shadow-sm"
                      style={{
                        background: `url('${systemConfig.backgroundImageUrl}') ${systemConfig.backgroundRepeat || 'repeat'}, ${systemConfig.gradientType || 'linear'}-gradient(${systemConfig.gradientDirection || '175deg'}, ${systemConfig.gradientStartColor || '#bb2558'} 0%${systemConfig.gradientMidColor ? `, ${systemConfig.gradientMidColor} 50%` : ''}, ${systemConfig.gradientEndColor || '#e8cf00'} 100%)`,
                        backgroundSize: systemConfig.backgroundSize || 'auto',
                        backgroundPosition: systemConfig.backgroundPosition || 'center'
                      }}
                    ></div>
                    <p className="text-xs text-gray-500">
                      Vista previa completa del fondo con imagen y degradado aplicados
                    </p>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Actualizar Colores"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="login" className="space-y-6">
              <form onSubmit={handleUpdateSystemConfig} className="space-y-6">
                {/* Personalización de página de login */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Personalización de Página de Login</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="login-title" className="block text-sm font-medium text-gray-700">
                        Título Principal
                      </label>
                      <Input
                        id="login-title"
                        value={systemConfig.loginTitle || 'Lanzamiento'}
                        onChange={(e) => setSystemConfig({
                          ...systemConfig,
                          loginTitle: e.target.value
                        })}
                        placeholder="Lanzamiento"
                      />
                      <p className="text-xs text-gray-500">
                        Título principal que aparece en la página de login
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="login-subtitle" className="block text-sm font-medium text-gray-700">
                        Subtítulo
                      </label>
                      <Input
                        id="login-subtitle"
                        value={systemConfig.loginSubtitle || '2025'}
                        onChange={(e) => setSystemConfig({
                          ...systemConfig,
                          loginSubtitle: e.target.value
                        })}
                        placeholder="2025"
                      />
                      <p className="text-xs text-gray-500">
                        Subtítulo que acompaña al título principal
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="login-welcome-text" className="block text-sm font-medium text-gray-700">
                      Texto de Bienvenida
                    </label>
                    <Input
                      id="login-welcome-text"
                      value={systemConfig.loginWelcomeText || 'Bienvenido al reto de identificación de riesgos'}
                      onChange={(e) => setSystemConfig({
                        ...systemConfig,
                        loginWelcomeText: e.target.value
                      })}
                      placeholder="Bienvenido al reto de identificación de riesgos"
                    />
                    <p className="text-xs text-gray-500">
                      Mensaje de bienvenida debajo del título
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="login-document-label" className="block text-sm font-medium text-gray-700">
                        Etiqueta Campo Documento
                      </label>
                      <Input
                        id="login-document-label"
                        value={systemConfig.loginDocumentLabel || 'Número de documento'}
                        onChange={(e) => setSystemConfig({
                          ...systemConfig,
                          loginDocumentLabel: e.target.value
                        })}
                        placeholder="Número de documento"
                      />
                      <p className="text-xs text-gray-500">
                        Etiqueta del campo de número de documento
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="login-name-label" className="block text-sm font-medium text-gray-700">
                        Etiqueta Campo Nombre
                      </label>
                      <Input
                        id="login-name-label"
                        value={systemConfig.loginNameLabel || 'Nombre completo'}
                        onChange={(e) => setSystemConfig({
                          ...systemConfig,
                          loginNameLabel: e.target.value
                        })}
                        placeholder="Nombre completo"
                      />
                      <p className="text-xs text-gray-500">
                        Etiqueta del campo de nombre completo
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="login-button-text" className="block text-sm font-medium text-gray-700">
                      Texto del Botón de Login
                    </label>
                    <Input
                      id="login-button-text"
                      value={systemConfig.loginButtonText || 'Ingresar'}
                      onChange={(e) => setSystemConfig({
                        ...systemConfig,
                        loginButtonText: e.target.value
                      })}
                      placeholder="Ingresar"
                    />
                    <p className="text-xs text-gray-500">
                      Texto que aparece en el botón principal de login
                    </p>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Actualizar Página de Login"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </TabsContent>
    </Tabs>

    {/* Diálogo para crear/editar assets */}
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "Crear Nuevo Segmento" : "Editar Segmento"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "create" 
                ? "Ingresa los detalles para un nuevo segmento del mapa" 
                : `Editar configuración del segmento ${selectedAsset?.segmentId}`
              }
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Configuración Básica</TabsTrigger>
              <TabsTrigger value="security">Seguridad y QR</TabsTrigger>
              <TabsTrigger value="content">Contenido y Modales</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 py-4">
              {/* Configuración básica del segmento */}
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="segmentId" className="text-right">
                ID Segmento
              </label>
              <Input
                id="segmentId"
                type="number"
                min="1"
                max="9"
                value={formData.segmentId}
                onChange={(e) => setFormData({...formData, segmentId: parseInt(e.target.value)})}
                className="col-span-3"
                disabled={dialogMode === "edit"}
                required
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="title" className="text-right">
                Título
              </label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="col-span-3"
                required
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="imageUrl" className="text-right">
                URL Imagen
              </label>
              <div className="col-span-3 space-y-2">
                <Input
                  id="imageUrl"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                  className="w-full"
                  placeholder="https://ejemplo.com/imagen.jpg"
                  required
                />
                <p className="text-xs text-gray-500">
                  Ingresa una URL completa a una imagen existente en internet. No es posible subir archivos directamente.
                </p>
                <p className="text-xs text-gray-500">
                  Ejemplos de URLs de imágenes: 
                  <br/>
                  https://images.unsplash.com/photo-1579546929518-9e396f3cc809
                  <br/>
                  https://placehold.co/400x400/3b82f6/ffffff?text=Segmento+{formData.segmentId}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="redirectUrl" className="text-right">
                URL Redirección
              </label>
              <div className="col-span-3 space-y-2">
                <Input
                  id="redirectUrl"
                  value={formData.redirectUrl}
                  onChange={(e) => setFormData({...formData, redirectUrl: e.target.value})}
                  className="w-full"
                  placeholder="https://ejemplo.com"
                />
                <p className="text-xs text-gray-500">
                  URL a la que se redirigirá cuando un usuario haga clic en el segmento desbloqueado (opcional)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 items-start gap-4">
              <label htmlFor="description" className="text-right pt-2">
                Descripción
              </label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="col-span-3"
                rows={3}
              />
            </div>
            </TabsContent>

            <TabsContent value="security" className="space-y-4 py-4">
              {/* Configuración de seguridad y QR */}

            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="securityCode" className="text-right">
                Código Seguridad
              </label>
              <div className="col-span-3 space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="securityCode"
                    value={formData.securityCode}
                    onChange={(e) => setFormData({...formData, securityCode: e.target.value})}
                    className="flex-1"
                    placeholder="ABCD1"
                    maxLength={5}
                    disabled={formData.generateNewCode}
                  />
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => setFormData({
                      ...formData, 
                      generateNewCode: !formData.generateNewCode
                    })}
                    className="whitespace-nowrap"
                  >
                    {formData.generateNewCode ? "Usar código manual" : "Generar nuevo"}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  {formData.generateNewCode 
                    ? "Se generará un nuevo código de seguridad al guardar" 
                    : "Código alfanumérico de 5 caracteres que los usuarios deberán escanear para desbloquear este segmento"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="isTrap" className="text-right">
                QR Trampa
              </label>
              <div className="col-span-3 space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isTrap"
                    checked={formData.isTrap}
                    onChange={(e) => setFormData({...formData, isTrap: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isTrap" className="text-sm text-gray-700">
                    Este QR es una trampa (no desbloquea segmento real)
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  Los QR trampa otorgan puntos falsos para situaciones sin riesgo real. Se usan para crear un ranking más interesante en actividades de identificación de riesgos laborales.
                </p>
              </div>
            </div>


            </TabsContent>

            <TabsContent value="content" className="space-y-4 py-4">
              {/* Configuración de contenido y modales */}
              
              {/* Campo de mensaje HTML para QR trampa */}
              {formData.isTrap && (
                <div className="grid grid-cols-4 items-start gap-4">
                  <label htmlFor="trapMessage" className="text-right mt-2">
                    Mensaje Trampa
                  </label>
                  <div className="col-span-3 space-y-2">
                    <textarea
                      id="trapMessage"
                      value={formData.trapMessage}
                      onChange={(e) => setFormData({...formData, trapMessage: e.target.value})}
                      placeholder="<h2>¡Situación Segura!</h2><p>Esta situación <strong>NO presenta riesgos</strong> reales. Has identificado correctamente una trampa.</p>"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500">
                      Mensaje HTML personalizable que se mostrará cuando alguien escanee este QR trampa. Puedes usar etiquetas como &lt;h2&gt;, &lt;p&gt;, &lt;strong&gt;, etc.
                    </p>
                  </div>
                </div>
              )}

              {/* Campo de contenido de modal para segmentos normales */}
              {!formData.isTrap && (
                <div className="grid grid-cols-4 items-start gap-4">
                  <label htmlFor="modalContent" className="text-right mt-2">
                    Contenido Modal (Opcional)
                  </label>
                  <div className="col-span-3 space-y-2">
                    <textarea
                      id="modalContent"
                      value={formData.modalContent}
                      onChange={(e) => setFormData({...formData, modalContent: e.target.value})}
                      placeholder="<h2>¡Segmento Desbloqueado!</h2><p>Información adicional sobre este segmento...</p>"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500">
                      Contenido HTML opcional que se mostrará en un modal cuando se desbloquee este segmento. Si está vacío, solo se mostrará el mensaje de éxito estándar.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveAsset} disabled={loadingAssets}>
              {loadingAssets ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPage;