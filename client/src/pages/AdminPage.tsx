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
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Users, 
  Award, 
  AlertTriangle, 
  LogOut,
  Eye,
  EyeOff,
  Settings,
  Palette,
  Image as ImageIcon,
  Type,
  UserCheck
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import AnalyticsTab from "@/components/AnalyticsTab";

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

interface MapSegmentAsset {
  id: number;
  segmentId: number;
  imageUrl: string;
  redirectUrl: string;
  title: string;
  description: string;
  securityCode: string;
  isTrap: boolean;
  trapMessage: string;
  modalContent: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SystemConfigData {
  id: number;
  appTitle: string;
  welcomeTitle: string;
  scanButtonText: string;
  progressText: string;
  completionMessage: string;
  bannerImageUrl: string;
  footerLogoUrl: string;
  siteMapImageUrl: string;
  backgroundImageUrl: string;
  backgroundSize: string;
  backgroundRepeat: string;
  backgroundPosition: string;
  gradientStartColor: string;
  gradientMidColor: string;
  gradientEndColor: string;
  gradientDirection: string;
  gradientType: string;
  loadingMessage: string;
  loginTitle: string;
  loginSubtitle: string;
  loginWelcomeText: string;
  loginFieldLabel: string;
  loginButtonText: string;
  loginLogoImageUrl: string;
  preloadImageUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UserProgress {
  user: {
    id: number;
    documentNumber: string;
    createdAt: Date;
  };
  segments: any[];
  totalSegments: number;
  unlockedSegments: number;
  completionPercentage: number;
  prize: any;
}

interface PrizeData {
  id: number;
  userId: number;
  redemptionCode: string;
  redeemed: boolean;
  redeemedAt?: Date;
  createdAt: Date;
}

const AdminPage = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // States
  const [redemptionCode, setRedemptionCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [prizeData, setPrizeData] = useState<PrizeData | null>(null);
  const [assets, setAssets] = useState<MapSegmentAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedAsset, setSelectedAsset] = useState<MapSegmentAsset | null>(null);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [loadingUserProgress, setLoadingUserProgress] = useState(false);
  const [systemConfig, setSystemConfig] = useState<SystemConfigData>({
    id: 1,
    appTitle: 'QR Code Quest',
    welcomeTitle: 'Bienvenido',
    scanButtonText: 'Escanear QR',
    progressText: 'Tu Progreso',
    completionMessage: '¡Felicitaciones! Has completado el mapa',
    bannerImageUrl: '',
    footerLogoUrl: '',
    siteMapImageUrl: '',
    backgroundImageUrl: '',
    backgroundSize: 'auto',
    backgroundRepeat: 'repeat',
    backgroundPosition: 'center',
    gradientStartColor: '#bb2558',
    gradientMidColor: '',
    gradientEndColor: '#e8cf00',
    gradientDirection: '175deg',
    gradientType: 'linear',
    loadingMessage: 'Cargando...',
    loginTitle: 'Iniciar Sesión',
    loginSubtitle: 'Accede a tu cuenta',
    loginWelcomeText: 'Bienvenido de vuelta',
    loginFieldLabel: 'Número de Documento',
    loginButtonText: 'Ingresar',
    loginLogoImageUrl: '',
    preloadImageUrl: '',
    createdAt: new Date(),
    updatedAt: new Date()
  });

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

  // Load system config on mount
  useEffect(() => {
    fetchSystemConfig();
  }, []);

  const fetchSystemConfig = async () => {
    try {
      const response = await fetch('/api/system-config');
      if (response.ok) {
        const config = await response.json();
        setSystemConfig(config);
      }
    } catch (error) {
      console.error('Error loading system config:', error);
    }
  };

  const handleUpdateSystemConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/system-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(systemConfig),
      });

      if (response.ok) {
        const updatedConfig = await response.json();
        setSystemConfig(updatedConfig);
        
        // Update CSS variables
        updateCSSVariables(updatedConfig);
        
        // Emit event for other components to update
        window.dispatchEvent(new CustomEvent('systemConfigUpdated', { detail: updatedConfig }));
        
        toast({
          title: "Configuración actualizada",
          description: "Los cambios se han aplicado correctamente.",
        });
      } else {
        throw new Error('Error al actualizar la configuración');
      }
    } catch (error) {
      console.error('Error updating system config:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la configuración.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateCSSVariables = (config: SystemConfigData) => {
    const root = document.documentElement;
    const timestamp = Date.now();
    
    root.style.setProperty('--app-title', `'${config.appTitle}'`);
    root.style.setProperty('--welcome-title', `'${config.welcomeTitle}'`);
    root.style.setProperty('--scan-button-text', `'${config.scanButtonText}'`);
    root.style.setProperty('--progress-text', `'${config.progressText}'`);
    root.style.setProperty('--completion-message', `'${config.completionMessage}'`);
    root.style.setProperty('--banner-image-url', config.bannerImageUrl ? `url('${config.bannerImageUrl}?t=${timestamp}')` : '');
    root.style.setProperty('--footer-logo-url', config.footerLogoUrl ? `url('${config.footerLogoUrl}?t=${timestamp}')` : '');
    root.style.setProperty('--site-map-image-url', config.siteMapImageUrl ? `url('${config.siteMapImageUrl}?t=${timestamp}')` : '');
    root.style.setProperty('--background-image-url', config.backgroundImageUrl ? `url('${config.backgroundImageUrl}?t=${timestamp}')` : '');
    root.style.setProperty('--background-size', config.backgroundSize || 'auto');
    root.style.setProperty('--background-repeat', config.backgroundRepeat || 'repeat');
    root.style.setProperty('--background-position', config.backgroundPosition || 'center');
    root.style.setProperty('--gradient-start-color', config.gradientStartColor || '#bb2558');
    root.style.setProperty('--gradient-mid-color', config.gradientMidColor || '');
    root.style.setProperty('--gradient-end-color', config.gradientEndColor || '#e8cf00');
    root.style.setProperty('--gradient-direction', config.gradientDirection || '175deg');
    root.style.setProperty('--gradient-type', config.gradientType || 'linear');
    root.style.setProperty('--loading-message', `'${config.loadingMessage}'`);
    root.style.setProperty('--login-title', `'${config.loginTitle}'`);
    root.style.setProperty('--login-subtitle', `'${config.loginSubtitle}'`);
    root.style.setProperty('--login-welcome-text', `'${config.loginWelcomeText}'`);
    root.style.setProperty('--login-field-label', `'${config.loginFieldLabel}'`);
    root.style.setProperty('--login-button-text', `'${config.loginButtonText}'`);
    root.style.setProperty('--login-logo-image-url', config.loginLogoImageUrl ? `url('${config.loginLogoImageUrl}?t=${timestamp}')` : '');
    root.style.setProperty('--preload-image-url', config.preloadImageUrl ? `url('${config.preloadImageUrl}?t=${timestamp}')` : '');
  };

  const handleValidatePrize = async () => {
    if (!redemptionCode.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un código de canje.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await redeemPrize(redemptionCode.trim());
      setPrizeData(result as any);
      toast({
        title: "Premio validado",
        description: `Premio canjeado exitosamente.`,
      });
    } catch (error) {
      console.error("Error validating prize:", error);
      toast({
        title: "Error",
        description: "Código de canje inválido o ya utilizado.",
        variant: "destructive",
      });
      setPrizeData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAssets = async () => {
    setLoadingAssets(true);
    try {
      const response = await fetch('/api/map-segment-assets');
      if (response.ok) {
        const data = await response.json();
        setAssets(data);
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los segmentos.",
        variant: "destructive",
      });
    } finally {
      setLoadingAssets(false);
    }
  };

  const fetchUserProgress = async () => {
    setLoadingUserProgress(true);
    try {
      const response = await fetch('/api/admin/users-progress');
      if (response.ok) {
        const data = await response.json();
        setUserProgress(data);
      }
    } catch (error) {
      console.error('Error fetching user progress:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar el progreso de usuarios.",
        variant: "destructive",
      });
    } finally {
      setLoadingUserProgress(false);
    }
  };

  useEffect(() => {
    fetchAssets();
    fetchUserProgress();
  }, []);

  const generateQRCode = async (segmentId: number, securityCode: string) => {
    const baseUrl = window.location.origin;
    const qrUrl = `${baseUrl}/unlock/${segmentId}/${securityCode}`;
    
    // Generate QR code using qrcode library
    const QRCode = (await import('qrcode')).default;
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      // Create download link
      const link = document.createElement('a');
      link.href = qrCodeDataUrl;
      link.download = `qr-segment-${segmentId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "QR generado",
        description: `Código QR para el segmento ${segmentId} descargado.`,
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el código QR.",
        variant: "destructive",
      });
    }
  };

  const handleSaveAsset = async () => {
    if (!formData.title || !formData.imageUrl || !formData.securityCode) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos requeridos.",
        variant: "destructive",
      });
      return;
    }

    setLoadingAssets(true);
    try {
      const url = dialogMode === "create" 
        ? '/api/map-segment-assets' 
        : `/api/map-segment-assets/${selectedAsset?.segmentId}`;
      
      const method = dialogMode === "create" ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchAssets();
        setDialogOpen(false);
        resetForm();
        toast({
          title: "Éxito",
          description: `Segmento ${dialogMode === "create" ? "creado" : "actualizado"} exitosamente.`,
        });
      } else {
        throw new Error('Error saving asset');
      }
    } catch (error) {
      console.error('Error saving asset:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el segmento.",
        variant: "destructive",
      });
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleDeleteAsset = async (segmentId: number) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este segmento?")) return;

    try {
      const response = await fetch(`/api/map-segment-assets/${segmentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchAssets();
        toast({
          title: "Éxito",
          description: "Segmento eliminado exitosamente.",
        });
      } else {
        throw new Error('Error deleting asset');
      }
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el segmento.",
        variant: "destructive",
      });
    }
  };

  const handleEditAsset = (asset: MapSegmentAsset) => {
    setSelectedAsset(asset);
    setFormData({
      segmentId: asset.segmentId,
      imageUrl: asset.imageUrl,
      redirectUrl: asset.redirectUrl,
      title: asset.title,
      description: asset.description,
      securityCode: asset.securityCode,
      isTrap: asset.isTrap,
      trapMessage: asset.trapMessage,
      modalContent: asset.modalContent,
      generateNewCode: false
    });
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const resetForm = () => {
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
      generateNewCode: false
    });
    setSelectedAsset(null);
  };

  const handleCreateNew = () => {
    resetForm();
    setDialogMode("create");
    setDialogOpen(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('adminLoggedIn');
    setLocation('/admin');
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-primary">Panel de Administración</h1>
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
          <TabsTrigger value="users">Progreso de Usuarios</TabsTrigger>
          <TabsTrigger value="analytics">Analíticas</TabsTrigger>
          <TabsTrigger value="frontend">Personalización</TabsTrigger>
          <TabsTrigger value="images">Imágenes</TabsTrigger>
        </TabsList>

        <TabsContent value="prizes">
          <Card>
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-xl flex items-center gap-2">
                <Award className="h-5 w-5" />
                Validación de Premios
              </CardTitle>
              <CardDescription className="text-white/80">
                Ingresa el código de canje para validar y marcar un premio como canjeado
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Input
                    placeholder="Código de canje del premio"
                    value={redemptionCode}
                    onChange={(e) => setRedemptionCode(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleValidatePrize} disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Validando...
                      </>
                    ) : (
                      "Validar Premio"
                    )}
                  </Button>
                </div>

                {prizeData && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <h3 className="font-semibold text-green-800">Premio Válido</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-semibold">ID del Premio:</span> {prizeData.id}
                      </div>
                      <div>
                        <span className="font-semibold">Usuario ID:</span> {prizeData.userId}
                      </div>
                      <div>
                        <span className="font-semibold">Código:</span> {prizeData.redemptionCode}
                      </div>
                      <div>
                        <span className="font-semibold">Estado:</span>
                        <Badge variant={prizeData.redeemed ? "destructive" : "default"} className="ml-2">
                          {prizeData.redeemed ? "Canjeado" : "Disponible"}
                        </Badge>
                      </div>
                      <div className="col-span-2">
                        <span className="font-semibold">Fecha de creación:</span> {new Date(prizeData.createdAt).toLocaleString()}
                      </div>
                      {prizeData.redeemed && prizeData.redeemedAt && (
                        <div className="col-span-2">
                          <span className="font-semibold">Canjeado el:</span> {new Date(prizeData.redeemedAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="segments">
          <Card>
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-xl flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Gestión de Segmentos del Mapa
              </CardTitle>
              <CardDescription className="text-white/80">
                Administra los segmentos del mapa, sus imágenes, códigos QR y configuraciones
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold">Segmentos Configurados</h3>
                <Button onClick={handleCreateNew} className="flex items-center gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Crear Nuevo Segmento
                </Button>
              </div>

              {loadingAssets ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Cargando segmentos...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableCaption>Lista de todos los segmentos del mapa configurados</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Segmento</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Imagen</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assets.map((asset) => (
                        <TableRow key={asset.id}>
                          <TableCell className="font-medium">#{asset.segmentId}</TableCell>
                          <TableCell>{asset.title}</TableCell>
                          <TableCell>
                            {asset.isTrap ? (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Trampa
                              </Badge>
                            ) : (
                              <Badge variant="default">Normal</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{asset.securityCode}</TableCell>
                          <TableCell>
                            {asset.imageUrl && (
                              <img 
                                src={asset.imageUrl} 
                                alt={asset.title}
                                className="w-12 h-12 object-cover rounded"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditAsset(asset)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => generateQRCode(asset.segmentId, asset.securityCode)}
                              >
                                QR
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteAsset(asset.segmentId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qrgenerator">
          <Card>
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-xl">Generador de Códigos QR</CardTitle>
              <CardDescription className="text-white/80">
                Genera y descarga códigos QR para los segmentos del mapa
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assets.map((asset) => (
                  <Card key={asset.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">Segmento #{asset.segmentId}</h4>
                      {asset.isTrap && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Trampa
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{asset.title}</p>
                    <Button
                      onClick={() => generateQRCode(asset.segmentId, asset.securityCode)}
                      className="w-full"
                      size="sm"
                    >
                      Generar QR
                    </Button>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-xl flex items-center gap-2">
                <Users className="h-5 w-5" />
                Progreso de Usuarios
              </CardTitle>
              <CardDescription className="text-white/80">
                Monitorea el progreso de todos los usuarios registrados
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {loadingUserProgress ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Cargando progreso...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableCaption>Progreso de todos los usuarios registrados</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Progreso</TableHead>
                        <TableHead>Segmentos</TableHead>
                        <TableHead>Premio</TableHead>
                        <TableHead>Registro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userProgress.map((progress) => (
                        <TableRow key={progress.user.id}>
                          <TableCell className="font-medium">#{progress.user.id}</TableCell>
                          <TableCell>{progress.user.documentNumber}</TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              <Progress value={progress.completionPercentage} className="w-24" />
                              <span className="text-sm text-gray-600">
                                {progress.completionPercentage.toFixed(1)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {progress.unlockedSegments} / {progress.totalSegments}
                            </span>
                          </TableCell>
                          <TableCell>
                            {progress.prize ? (
                              <Badge variant="default" className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Generado
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Pendiente</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {new Date(progress.user.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsTab />
        </TabsContent>

        <TabsContent value="frontend">
          <Card className="w-full">
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-xl">Personalización del Frontend</CardTitle>
              <CardDescription className="text-white/80">
                Personaliza títulos, textos de botones y elementos visuales de la aplicación
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <Tabs defaultValue="personalizacion" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="personalizacion">Personalización</TabsTrigger>
                  <TabsTrigger value="imagenes">Imágenes</TabsTrigger>
                  <TabsTrigger value="colores">Colores</TabsTrigger>
                  <TabsTrigger value="login">Página Login</TabsTrigger>
                </TabsList>

                <TabsContent value="personalizacion" className="space-y-6">
                  <form onSubmit={handleUpdateSystemConfig} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="appTitle">Título de la Aplicación</Label>
                        <Input
                          id="appTitle"
                          value={systemConfig.appTitle}
                          onChange={(e) => setSystemConfig({...systemConfig, appTitle: e.target.value})}
                          placeholder="QR Code Quest"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="welcomeTitle">Título de Bienvenida</Label>
                        <Input
                          id="welcomeTitle"
                          value={systemConfig.welcomeTitle}
                          onChange={(e) => setSystemConfig({...systemConfig, welcomeTitle: e.target.value})}
                          placeholder="Bienvenido"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="scanButtonText">Texto del Botón de Escaneo</Label>
                        <Input
                          id="scanButtonText"
                          value={systemConfig.scanButtonText}
                          onChange={(e) => setSystemConfig({...systemConfig, scanButtonText: e.target.value})}
                          placeholder="Escanear QR"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="progressText">Texto de Progreso</Label>
                        <Input
                          id="progressText"
                          value={systemConfig.progressText}
                          onChange={(e) => setSystemConfig({...systemConfig, progressText: e.target.value})}
                          placeholder="Tu Progreso"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="loadingMessage">Mensaje de Carga</Label>
                        <Input
                          id="loadingMessage"
                          value={systemConfig.loadingMessage}
                          onChange={(e) => setSystemConfig({...systemConfig, loadingMessage: e.target.value})}
                          placeholder="Cargando..."
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="completionMessage">Mensaje de Completado</Label>
                        <Textarea
                          id="completionMessage"
                          value={systemConfig.completionMessage}
                          onChange={(e) => setSystemConfig({...systemConfig, completionMessage: e.target.value})}
                          placeholder="¡Felicitaciones! Has completado el mapa"
                          className="min-h-[100px]"
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        "Actualizar Personalización"
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="imagenes" className="space-y-6">
                  <form onSubmit={handleUpdateSystemConfig} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="bannerImageUrl">URL de Imagen Banner/Cobranding</Label>
                        <Input
                          id="bannerImageUrl"
                          value={systemConfig.bannerImageUrl}
                          onChange={(e) => setSystemConfig({...systemConfig, bannerImageUrl: e.target.value})}
                          placeholder="https://ejemplo.com/banner.png"
                        />
                        {systemConfig.bannerImageUrl && (
                          <div className="mt-2">
                            <img src={`${systemConfig.bannerImageUrl}?t=${Date.now()}`} alt="Vista previa banner" className="max-w-full h-20 object-contain border rounded" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="footerLogoUrl">URL de Logo del Footer</Label>
                        <Input
                          id="footerLogoUrl"
                          value={systemConfig.footerLogoUrl}
                          onChange={(e) => setSystemConfig({...systemConfig, footerLogoUrl: e.target.value})}
                          placeholder="https://ejemplo.com/logo.png"
                        />
                        {systemConfig.footerLogoUrl && (
                          <div className="mt-2">
                            <img src={`${systemConfig.footerLogoUrl}?t=${Date.now()}`} alt="Vista previa logo footer" className="max-w-full h-20 object-contain border rounded" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="siteMapImageUrl">URL de Imagen del Mapa del Sitio</Label>
                        <Input
                          id="siteMapImageUrl"
                          value={systemConfig.siteMapImageUrl}
                          onChange={(e) => setSystemConfig({...systemConfig, siteMapImageUrl: e.target.value})}
                          placeholder="https://ejemplo.com/sitemap.png"
                        />
                        {systemConfig.siteMapImageUrl && (
                          <div className="mt-2">
                            <img src={`${systemConfig.siteMapImageUrl}?t=${Date.now()}`} alt="Vista previa mapa del sitio" className="max-w-full h-20 object-contain border rounded" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="backgroundImageUrl">URL de Imagen de Fondo</Label>
                        <Input
                          id="backgroundImageUrl"
                          value={systemConfig.backgroundImageUrl}
                          onChange={(e) => setSystemConfig({...systemConfig, backgroundImageUrl: e.target.value})}
                          placeholder="https://ejemplo.com/background.png"
                        />
                        {systemConfig.backgroundImageUrl && (
                          <div className="mt-2">
                            <img src={`${systemConfig.backgroundImageUrl}?t=${Date.now()}`} alt="Vista previa fondo" className="max-w-full h-20 object-contain border rounded" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Advanced background controls */}
                    <div className="space-y-4 border-t pt-4">
                      <h4 className="text-lg font-semibold">Configuración Avanzada de Fondo</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="backgroundSize">Tamaño de Fondo</Label>
                          <Select 
                            value={systemConfig.backgroundSize} 
                            onValueChange={(value) => setSystemConfig({...systemConfig, backgroundSize: value})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">Auto</SelectItem>
                              <SelectItem value="cover">Cubrir</SelectItem>
                              <SelectItem value="contain">Contener</SelectItem>
                              <SelectItem value="100% 100%">Estirar</SelectItem>
                              <SelectItem value="50%">50%</SelectItem>
                              <SelectItem value="75%">75%</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="backgroundRepeat">Repetición de Fondo</Label>
                          <Select 
                            value={systemConfig.backgroundRepeat} 
                            onValueChange={(value) => setSystemConfig({...systemConfig, backgroundRepeat: value})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="repeat">Repetir</SelectItem>
                              <SelectItem value="no-repeat">No repetir</SelectItem>
                              <SelectItem value="repeat-x">Repetir horizontal</SelectItem>
                              <SelectItem value="repeat-y">Repetir vertical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="backgroundPosition">Posición de Fondo</Label>
                          <Select 
                            value={systemConfig.backgroundPosition} 
                            onValueChange={(value) => setSystemConfig({...systemConfig, backgroundPosition: value})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="center">Centro</SelectItem>
                              <SelectItem value="top">Arriba</SelectItem>
                              <SelectItem value="bottom">Abajo</SelectItem>
                              <SelectItem value="left">Izquierda</SelectItem>
                              <SelectItem value="right">Derecha</SelectItem>
                              <SelectItem value="top left">Arriba izquierda</SelectItem>
                              <SelectItem value="top right">Arriba derecha</SelectItem>
                              <SelectItem value="bottom left">Abajo izquierda</SelectItem>
                              <SelectItem value="bottom right">Abajo derecha</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
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

                <TabsContent value="colores" className="space-y-6">
                  <form onSubmit={handleUpdateSystemConfig} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="gradientStartColor">Color Inicial del Degradado</Label>
                        <div className="flex gap-2">
                          <Input
                            id="gradientStartColor"
                            type="color"
                            value={systemConfig.gradientStartColor}
                            onChange={(e) => setSystemConfig({...systemConfig, gradientStartColor: e.target.value})}
                            className="w-16 h-10 p-1 border rounded"
                          />
                          <Input
                            value={systemConfig.gradientStartColor}
                            onChange={(e) => setSystemConfig({...systemConfig, gradientStartColor: e.target.value})}
                            placeholder="#bb2558"
                            className="flex-1"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="gradientEndColor">Color Final del Degradado</Label>
                        <div className="flex gap-2">
                          <Input
                            id="gradientEndColor"
                            type="color"
                            value={systemConfig.gradientEndColor}
                            onChange={(e) => setSystemConfig({...systemConfig, gradientEndColor: e.target.value})}
                            className="w-16 h-10 p-1 border rounded"
                          />
                          <Input
                            value={systemConfig.gradientEndColor}
                            onChange={(e) => setSystemConfig({...systemConfig, gradientEndColor: e.target.value})}
                            placeholder="#e8cf00"
                            className="flex-1"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="gradientMidColor">Color Medio del Degradado (Opcional)</Label>
                        <div className="flex gap-2">
                          <Input
                            id="gradientMidColor"
                            type="color"
                            value={systemConfig.gradientMidColor || '#ffffff'}
                            onChange={(e) => setSystemConfig({...systemConfig, gradientMidColor: e.target.value})}
                            className="w-16 h-10 p-1 border rounded"
                          />
                          <Input
                            value={systemConfig.gradientMidColor}
                            onChange={(e) => setSystemConfig({...systemConfig, gradientMidColor: e.target.value})}
                            placeholder="Opcional - para degradados de 3 colores"
                            className="flex-1"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="gradientDirection">Dirección del Degradado</Label>
                        <Select 
                          value={systemConfig.gradientDirection} 
                          onValueChange={(value) => setSystemConfig({...systemConfig, gradientDirection: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0deg">Horizontal (0°)</SelectItem>
                            <SelectItem value="45deg">Diagonal NE (45°)</SelectItem>
                            <SelectItem value="90deg">Vertical (90°)</SelectItem>
                            <SelectItem value="135deg">Diagonal SE (135°)</SelectItem>
                            <SelectItem value="180deg">Horizontal Inverso (180°)</SelectItem>
                            <SelectItem value="225deg">Diagonal SW (225°)</SelectItem>
                            <SelectItem value="270deg">Vertical Inverso (270°)</SelectItem>
                            <SelectItem value="315deg">Diagonal NW (315°)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="gradientType">Tipo de Degradado</Label>
                        <Select 
                          value={systemConfig.gradientType} 
                          onValueChange={(value) => setSystemConfig({...systemConfig, gradientType: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="linear">Lineal</SelectItem>
                            <SelectItem value="radial">Radial</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* Vista previa del degradado */}
                    <div className="space-y-2">
                      <Label className="block text-sm font-medium text-gray-700">
                        Vista Previa del Degradado y Fondo
                      </Label>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="loginTitle">Título de Login</Label>
                        <Input
                          id="loginTitle"
                          value={systemConfig.loginTitle}
                          onChange={(e) => setSystemConfig({...systemConfig, loginTitle: e.target.value})}
                          placeholder="Iniciar Sesión"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="loginSubtitle">Subtítulo de Login</Label>
                        <Input
                          id="loginSubtitle"
                          value={systemConfig.loginSubtitle}
                          onChange={(e) => setSystemConfig({...systemConfig, loginSubtitle: e.target.value})}
                          placeholder="Accede a tu cuenta"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="loginWelcomeText">Texto de Bienvenida</Label>
                        <Input
                          id="loginWelcomeText"
                          value={systemConfig.loginWelcomeText}
                          onChange={(e) => setSystemConfig({...systemConfig, loginWelcomeText: e.target.value})}
                          placeholder="Bienvenido de vuelta"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="loginFieldLabel">Etiqueta del Campo</Label>
                        <Input
                          id="loginFieldLabel"
                          value={systemConfig.loginFieldLabel}
                          onChange={(e) => setSystemConfig({...systemConfig, loginFieldLabel: e.target.value})}
                          placeholder="Número de Documento"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="loginButtonText">Texto del Botón</Label>
                        <Input
                          id="loginButtonText"
                          value={systemConfig.loginButtonText}
                          onChange={(e) => setSystemConfig({...systemConfig, loginButtonText: e.target.value})}
                          placeholder="Ingresar"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="loginLogoImageUrl">URL de Logo de Login</Label>
                        <Input
                          id="loginLogoImageUrl"
                          value={systemConfig.loginLogoImageUrl}
                          onChange={(e) => setSystemConfig({...systemConfig, loginLogoImageUrl: e.target.value})}
                          placeholder="https://ejemplo.com/logo-login.png"
                        />
                        {systemConfig.loginLogoImageUrl && (
                          <div className="mt-2">
                            <img src={`${systemConfig.loginLogoImageUrl}?t=${Date.now()}`} alt="Vista previa logo login" className="max-w-full h-20 object-contain border rounded" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="preloadImageUrl">URL de Imagen de Precarga</Label>
                        <Input
                          id="preloadImageUrl"
                          value={systemConfig.preloadImageUrl}
                          onChange={(e) => setSystemConfig({...systemConfig, preloadImageUrl: e.target.value})}
                          placeholder="https://ejemplo.com/preload.png"
                        />
                        {systemConfig.preloadImageUrl && (
                          <div className="mt-2">
                            <img src={`${systemConfig.preloadImageUrl}?t=${Date.now()}`} alt="Vista previa imagen precarga" className="max-w-full h-20 object-contain border rounded" />
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
                        "Actualizar Página de Login"
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="images">
          <Card>
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-xl flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Gestión de Imágenes
              </CardTitle>
              <CardDescription className="text-white/80">
                Administra todas las imágenes utilizadas en la aplicación
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Banner/Cobranding */}
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Banner/Cobranding
                  </h4>
                  {systemConfig.bannerImageUrl ? (
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <img 
                        src={`${systemConfig.bannerImageUrl}?t=${Date.now()}`} 
                        alt="Banner" 
                        className="w-full h-32 object-contain rounded"
                      />
                      <p className="text-xs text-gray-600 mt-2 truncate">{systemConfig.bannerImageUrl}</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg p-6 bg-gray-50 text-center text-gray-500">
                      <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No configurado</p>
                    </div>
                  )}
                </div>

                {/* Footer Logo */}
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Logo del Footer
                  </h4>
                  {systemConfig.footerLogoUrl ? (
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <img 
                        src={`${systemConfig.footerLogoUrl}?t=${Date.now()}`} 
                        alt="Footer Logo" 
                        className="w-full h-32 object-contain rounded"
                      />
                      <p className="text-xs text-gray-600 mt-2 truncate">{systemConfig.footerLogoUrl}</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg p-6 bg-gray-50 text-center text-gray-500">
                      <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No configurado</p>
                    </div>
                  )}
                </div>

                {/* Mapa del Sitio */}
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Mapa del Sitio
                  </h4>
                  {systemConfig.siteMapImageUrl ? (
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <img 
                        src={`${systemConfig.siteMapImageUrl}?t=${Date.now()}`} 
                        alt="Site Map" 
                        className="w-full h-32 object-contain rounded"
                      />
                      <p className="text-xs text-gray-600 mt-2 truncate">{systemConfig.siteMapImageUrl}</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg p-6 bg-gray-50 text-center text-gray-500">
                      <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No configurado</p>
                    </div>
                  )}
                </div>

                {/* Imagen de Fondo */}
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Imagen de Fondo
                  </h4>
                  {systemConfig.backgroundImageUrl ? (
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <img 
                        src={`${systemConfig.backgroundImageUrl}?t=${Date.now()}`} 
                        alt="Background" 
                        className="w-full h-32 object-contain rounded"
                      />
                      <p className="text-xs text-gray-600 mt-2 truncate">{systemConfig.backgroundImageUrl}</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg p-6 bg-gray-50 text-center text-gray-500">
                      <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No configurado</p>
                    </div>
                  )}
                </div>

                {/* Logo de Login */}
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Logo de Login
                  </h4>
                  {systemConfig.loginLogoImageUrl ? (
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <img 
                        src={`${systemConfig.loginLogoImageUrl}?t=${Date.now()}`} 
                        alt="Login Logo" 
                        className="w-full h-32 object-contain rounded"
                      />
                      <p className="text-xs text-gray-600 mt-2 truncate">{systemConfig.loginLogoImageUrl}</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg p-6 bg-gray-50 text-center text-gray-500">
                      <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No configurado</p>
                    </div>
                  )}
                </div>

                {/* Imagen de Precarga */}
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Loader2 className="h-4 w-4" />
                    Imagen de Precarga
                  </h4>
                  {systemConfig.preloadImageUrl ? (
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <img 
                        src={`${systemConfig.preloadImageUrl}?t=${Date.now()}`} 
                        alt="Preload" 
                        className="w-full h-32 object-contain rounded"
                      />
                      <p className="text-xs text-gray-600 mt-2 truncate">{systemConfig.preloadImageUrl}</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg p-6 bg-gray-50 text-center text-gray-500">
                      <Loader2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No configurado</p>
                    </div>
                  )}
                </div>

              </div>
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

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="segmentId">ID del Segmento</Label>
                  <Input
                    id="segmentId"
                    type="number"
                    value={formData.segmentId}
                    onChange={(e) => setFormData({...formData, segmentId: parseInt(e.target.value)})}
                    disabled={dialogMode === "edit"}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="imageUrl">URL de la Imagen</Label>
                  <Input
                    id="imageUrl"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="redirectUrl">URL de Redirección (Opcional)</Label>
                  <Input
                    id="redirectUrl"
                    value={formData.redirectUrl}
                    onChange={(e) => setFormData({...formData, redirectUrl: e.target.value})}
                    placeholder="https://ejemplo.com/info-adicional"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="securityCode">Código de Seguridad</Label>
                  <div className="flex gap-2">
                    <Input
                      id="securityCode"
                      value={formData.securityCode}
                      onChange={(e) => setFormData({...formData, securityCode: e.target.value})}
                      className="flex-1"
                    />
                    {dialogMode === "edit" && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="generateNewCode"
                          checked={formData.generateNewCode}
                          onCheckedChange={(checked) => setFormData({...formData, generateNewCode: checked as boolean})}
                        />
                        <Label htmlFor="generateNewCode" className="text-sm">
                          Generar nuevo código
                        </Label>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    Código alfanumérico que debe coincidir con el código QR
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isTrap"
                    checked={formData.isTrap}
                    onCheckedChange={(checked) => setFormData({...formData, isTrap: checked})}
                  />
                  <Label htmlFor="isTrap">
                    Marcar como Trampa (Código QR falso para entrenamiento)
                  </Label>
                </div>

                {formData.isTrap && (
                  <div className="space-y-2">
                    <Label htmlFor="trapMessage">Mensaje de Trampa</Label>
                    <Textarea
                      id="trapMessage"
                      value={formData.trapMessage}
                      onChange={(e) => setFormData({...formData, trapMessage: e.target.value})}
                      placeholder="¡Atención! Este es un código QR trampa para entrenamiento..."
                      className="min-h-[100px]"
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="content" className="space-y-4">
              {!formData.isTrap && (
                <div className="space-y-2">
                  <Label htmlFor="modalContent">Contenido del Modal (HTML Opcional)</Label>
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
      </Tabs>
    </div>
  );
};

export default AdminPage;