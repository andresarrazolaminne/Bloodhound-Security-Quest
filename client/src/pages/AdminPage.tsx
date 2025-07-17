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
import { MapSegmentAsset, Venue, InsertVenue } from "@shared/schema";
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
  const [updatingConfig, setUpdatingConfig] = useState(false);
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
    // Text colors configuration
    primaryTextColor: "#1a1a1a",
    secondaryTextColor: "#6b7280",
    titleTextColor: "#111827",
    buttonTextColor: "#ffffff",
    linkTextColor: "#3b82f6",
    successTextColor: "#059669",
    errorTextColor: "#dc2626",
    warningTextColor: "#d97706",
    // UI component colors
    headerBackgroundColor: "#3b82f6",
    headerTextColor: "#ffffff",
    // Login page customization
    loginTitle: "Lanzamiento",
    loginSubtitle: "2025",
    loginWelcomeText: "Bienvenido al reto de identificación de riesgos",
    loginButtonText: "Ingresar",
    loginDocumentLabel: "Número de documento",
    loginNameLabel: "Nombre completo",
    loginLogoImageUrl: "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png",
    registrationImageUrl: "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png",
    headerLogoImageUrl: "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png",
    headerLogoSize: 32,
    preloadImageUrl: "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png",
    scanButtonText: "",
    helpButtonText: "",
    siteMapButtonText: "",
    prizeButtonText: "",
    completionTitle: "",
    loadingText: "",
    // Mensajes de logros y trampas
    achievementUnlockedTitle: "¡Logro Desbloqueado!",
    achievementUnlockedMessage: "¡Segmento {segmentId} desbloqueado exitosamente!",
    trapDetectedTitle: "¡Situación de Riesgo Detectada!",
    trapDetectedMessage: "¡Has identificado una situación de riesgo! +{trapPoints} punto(s) de penalización."
  });
  
  // Gestión de sedes
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);
  const [venueDialogMode, setVenueDialogMode] = useState<"create" | "edit">("create");
  const [venueFormData, setVenueFormData] = useState<InsertVenue>({
    name: "",
    description: "",
    location: "",
    isActive: true,
    maxParticipants: 100
  });
  const [venueRankings, setVenueRankings] = useState<{ [venueId: number]: any[] }>({});
  
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
        cobrandingImageUrl: config.cobrandingImageUrl || "",
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
        // Text colors configuration
        primaryTextColor: config.primaryTextColor || "#1a1a1a",
        secondaryTextColor: config.secondaryTextColor || "#6b7280",
        titleTextColor: config.titleTextColor || "#111827",
        buttonTextColor: config.buttonTextColor || "#ffffff",
        linkTextColor: config.linkTextColor || "#3b82f6",
        successTextColor: config.successTextColor || "#059669",
        errorTextColor: config.errorTextColor || "#dc2626",
        warningTextColor: config.warningTextColor || "#d97706",
        // UI component colors
        headerBackgroundColor: config.headerBackgroundColor || "#3b82f6",
        headerTextColor: config.headerTextColor || "#ffffff",
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
        registrationImageUrl: config.registrationImageUrl || "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png",
        headerLogoImageUrl: config.headerLogoImageUrl || "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png",
        headerLogoSize: config.headerLogoSize || 32,
        preloadImageUrl: config.preloadImageUrl || "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png",
        // Mensajes de logros y trampas
        achievementUnlockedTitle: config.achievementUnlockedTitle || "¡Logro Desbloqueado!",
        achievementUnlockedMessage: config.achievementUnlockedMessage || "¡Segmento {segmentId} desbloqueado exitosamente!",
        trapDetectedTitle: config.trapDetectedTitle || "¡Situación de Riesgo Detectada!",
        trapDetectedMessage: config.trapDetectedMessage || "¡Has identificado una situación de riesgo! +{trapPoints} punto(s) de penalización."
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
      setUpdatingConfig(true);
      
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
            // Mensajes de logros y trampas
            achievementUnlockedTitle: data.config.achievementUnlockedTitle || "¡Logro Desbloqueado!",
            achievementUnlockedMessage: data.config.achievementUnlockedMessage || "¡Segmento {segmentId} desbloqueado exitosamente!",
            trapDetectedTitle: data.config.trapDetectedTitle || "¡Situación de Riesgo Detectada!",
            trapDetectedMessage: data.config.trapDetectedMessage || "¡Has identificado una situación de riesgo! +{trapPoints} punto(s) de penalización.",
            loginTitle: data.config.loginTitle || "Lanzamiento",
            loginSubtitle: data.config.loginSubtitle || "2025",
            loginWelcomeText: data.config.loginWelcomeText || "Bienvenido al reto de identificación de riesgos",
            loginButtonText: data.config.loginButtonText || "Ingresar",
            loginDocumentLabel: data.config.loginDocumentLabel || "Número de documento",
            loginNameLabel: data.config.loginNameLabel || "Nombre completo",
            loginLogoImageUrl: data.config.loginLogoImageUrl || "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png",
            headerLogoImageUrl: data.config.headerLogoImageUrl || "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png",
            headerLogoSize: data.config.headerLogoSize || 32,
            preloadImageUrl: data.config.preloadImageUrl || "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png",
            registrationImageUrl: data.config.registrationImageUrl || "https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png",
            // Text colors configuration
            primaryTextColor: data.config.primaryTextColor || "#1a1a1a",
            secondaryTextColor: data.config.secondaryTextColor || "#6b7280",
            titleTextColor: data.config.titleTextColor || "#111827",
            buttonTextColor: data.config.buttonTextColor || "#ffffff",
            linkTextColor: data.config.linkTextColor || "#3b82f6",
            successTextColor: data.config.successTextColor || "#059669",
            errorTextColor: data.config.errorTextColor || "#dc2626",
            warningTextColor: data.config.warningTextColor || "#d97706",
            // UI component colors
            headerBackgroundColor: data.config.headerBackgroundColor || "#3b82f6",
            headerTextColor: data.config.headerTextColor || "#ffffff"
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
      setUpdatingConfig(false);
    }
  };

  // Cargar assets de segmentos del mapa y configuración del sistema al iniciar
  useEffect(() => {
    fetchMapAssets();
    fetchSystemConfig();
    fetchUserRanking();
    fetchVenues();
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

  const fetchVenues = async () => {
    try {
      setLoadingVenues(true);
      const response = await apiRequest("GET", "/api/admin/venues");
      const data = await response.json();
      setVenues(data.venues);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar las sedes",
        variant: "destructive"
      });
    } finally {
      setLoadingVenues(false);
    }
  };

  const fetchVenueRanking = async (venueId: number) => {
    try {
      const response = await apiRequest("GET", `/api/admin/venues/${venueId}/ranking`);
      const data = await response.json();
      setVenueRankings(prev => ({ ...prev, [venueId]: data.ranking }));
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar el ranking de la sede",
        variant: "destructive"
      });
    }
  };

  const handleVenueCreate = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest("POST", "/api/admin/venues", venueFormData);
      
      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Sede creada exitosamente"
        });
        setVenueDialogOpen(false);
        setVenueFormData({
          name: "",
          description: "",
          location: "",
          isActive: true,
          maxParticipants: 100
        });
        fetchVenues();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al crear la sede",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVenueUpdate = async () => {
    if (!selectedVenue) return;
    
    try {
      setIsLoading(true);
      const response = await apiRequest("PUT", `/api/admin/venues/${selectedVenue.id}`, venueFormData);
      
      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Sede actualizada exitosamente"
        });
        setVenueDialogOpen(false);
        setSelectedVenue(null);
        fetchVenues();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al actualizar la sede",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVenueDelete = async (venueId: number) => {
    try {
      setIsLoading(true);
      const response = await apiRequest("DELETE", `/api/admin/venues/${venueId}`);
      
      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Sede eliminada exitosamente"
        });
        fetchVenues();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al eliminar la sede",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openVenueDialog = (mode: "create" | "edit", venue?: Venue) => {
    setVenueDialogMode(mode);
    if (mode === "edit" && venue) {
      setSelectedVenue(venue);
      setVenueFormData({
        name: venue.name,
        description: venue.description || "",
        location: venue.location || "",
        isActive: venue.isActive,
        maxParticipants: venue.maxParticipants || 100
      });
    } else {
      setVenueFormData({
        name: "",
        description: "",
        location: "",
        isActive: true,
        maxParticipants: 100
      });
    }
    setVenueDialogOpen(true);
  };

  // Función para abrir el diálogo de crear asset
  const handleCreateAsset = () => {
    setDialogMode("create");
    
    // Find the next available segment ID
    const existingSegmentIds = mapAssets.map(asset => asset.segmentId);
    let nextSegmentId = 1;
    while (existingSegmentIds.includes(nextSegmentId)) {
      nextSegmentId++;
    }
    
    setFormData({
      segmentId: nextSegmentId,
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
        const createResponse = await apiRequest("POST", "/api/admin/map-assets", payload);
        if (!createResponse.ok) {
          const errorData = await createResponse.json();
          throw new Error(errorData.message || 'Error al crear el segmento');
        }
        toast({
          title: "Éxito",
          description: "Segmento creado correctamente"
        });
      } else {
        // Actualizar asset existente
        const updateResponse = await apiRequest("PUT", `/api/admin/map-assets/${formData.segmentId}`, payload);
        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          throw new Error(errorData.message || 'Error al actualizar el segmento');
        }
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
        description: `Error al guardar el segmento: ${error.message || 'Error desconocido'}`,
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
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-8 mb-6">
          <TabsTrigger value="prizes">Validación de Premios</TabsTrigger>
          <TabsTrigger value="segments">Segmentos del Mapa</TabsTrigger>
          <TabsTrigger value="venues">Sedes</TabsTrigger>
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

        <TabsContent value="venues">
          <Card className="w-full">
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-xl">Gestión de Sedes</CardTitle>
              <CardDescription className="text-white/80">
                Administra las sedes/ubicaciones donde se desarrolla la actividad
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="flex justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-600">
                    Total de Sedes: <span className="font-semibold">{venues.length}</span>
                  </div>
                  <div className="text-sm text-green-600">
                    ✅ Activas: <span className="font-semibold">{venues.filter(v => v.isActive).length}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    ❌ Inactivas: <span className="font-semibold">{venues.filter(v => !v.isActive).length}</span>
                  </div>
                </div>
                <Button onClick={() => openVenueDialog("create")}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nueva Sede
                </Button>
              </div>

              {loadingVenues ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Cargando sedes...</span>
                </div>
              ) : venues.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay sedes configuradas. Crea la primera sede para empezar.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {venues.map((venue) => (
                    <Card key={venue.id} className="border-gray-200">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{venue.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={venue.isActive ? "success" : "destructive"}>
                                {venue.isActive ? "Activa" : "Inactiva"}
                              </Badge>
                              {venue.maxParticipants && (
                                <Badge variant="outline">
                                  Máx: {venue.maxParticipants}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pb-3">
                        {venue.description && (
                          <p className="text-sm text-gray-600 mb-2">{venue.description}</p>
                        )}
                        {venue.location && (
                          <p className="text-sm text-gray-500 mb-3">📍 {venue.location}</p>
                        )}
                        
                        <div className="space-y-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="w-full"
                            onClick={() => fetchVenueRanking(venue.id)}
                          >
                            <BarChart className="h-4 w-4 mr-2" />
                            Ver Ranking
                          </Button>
                          
                          {venueRankings[venue.id] && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-md">
                              <h4 className="font-medium text-sm mb-2">Ranking de {venue.name}</h4>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {venueRankings[venue.id].slice(0, 5).map((participant, index) => (
                                  <div key={participant.user.id} className="flex justify-between text-xs">
                                    <span>#{index + 1} {participant.user.name}</span>
                                    <span className="font-medium">{participant.completionPercentage.toFixed(1)}%</span>
                                  </div>
                                ))}
                                {venueRankings[venue.id].length > 5 && (
                                  <div className="text-xs text-gray-500 text-center">
                                    +{venueRankings[venue.id].length - 5} más...
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>

                      <CardFooter className="flex justify-between p-4 pt-0">
                        <Button variant="outline" size="sm" onClick={() => openVenueDialog("edit", venue)}>
                          <Pencil className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => {
                            if (confirm(`¿Estás seguro de eliminar la sede "${venue.name}"?`)) {
                              handleVenueDelete(venue.id);
                            }
                          }}
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
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        </div>
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
                          Mensaje que se muestra durante las pantallas de carga
                        </p>
                      </div>
                    </div>

                    {/* Mensajes de logros y trampas */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Mensajes de Logros y Trampas</h3>
                      
                      {/* Mensajes de logros */}
                      <div className="space-y-4 bg-green-50 p-4 rounded-lg">
                        <h4 className="text-md font-medium text-green-800">🏆 Mensajes de Logro</h4>
                        
                        <div className="space-y-2">
                          <label htmlFor="achievement-title" className="block text-sm font-medium text-gray-700">
                            Título del Logro Desbloqueado
                          </label>
                          <Input
                            id="achievement-title"
                            value={systemConfig.achievementUnlockedTitle}
                            onChange={(e) => setSystemConfig({
                              ...systemConfig,
                              achievementUnlockedTitle: e.target.value
                            })}
                            placeholder="¡Logro Desbloqueado!"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label htmlFor="achievement-message" className="block text-sm font-medium text-gray-700">
                            Mensaje del Logro Desbloqueado
                          </label>
                          <Input
                            id="achievement-message"
                            value={systemConfig.achievementUnlockedMessage}
                            onChange={(e) => setSystemConfig({
                              ...systemConfig,
                              achievementUnlockedMessage: e.target.value
                            })}
                            placeholder="¡Segmento {segmentId} desbloqueado exitosamente!"
                          />
                          <p className="text-xs text-gray-500">
                            Puedes usar <code>{'{segmentId}'}</code> para mostrar el número del segmento
                          </p>
                        </div>
                      </div>
                      
                      {/* Mensajes de trampa */}
                      <div className="space-y-4 bg-red-50 p-4 rounded-lg">
                        <h4 className="text-md font-medium text-red-800">⚠️ Mensajes de Trampa</h4>
                        
                        <div className="space-y-2">
                          <label htmlFor="trap-title" className="block text-sm font-medium text-gray-700">
                            Título de Situación de Riesgo
                          </label>
                          <Input
                            id="trap-title"
                            value={systemConfig.trapDetectedTitle}
                            onChange={(e) => setSystemConfig({
                              ...systemConfig,
                              trapDetectedTitle: e.target.value
                            })}
                            placeholder="¡Situación de Riesgo Detectada!"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label htmlFor="trap-message" className="block text-sm font-medium text-gray-700">
                            Mensaje de Situación de Riesgo
                          </label>
                          <Input
                            id="trap-message"
                            value={systemConfig.trapDetectedMessage}
                            onChange={(e) => setSystemConfig({
                              ...systemConfig,
                              trapDetectedMessage: e.target.value
                            })}
                            placeholder="¡Has identificado una situación de riesgo! +{trapPoints} punto(s) de penalización."
                          />
                          <p className="text-xs text-gray-500">
                            Puedes usar <code>{'{trapPoints}'}</code> para mostrar los puntos de penalización y <code>{'{segmentId}'}</code> para el segmento
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Actualizando...
                        </>
                      ) : (
                        "Actualizar Personalización"
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="images" className="space-y-6">
                  <form onSubmit={handleUpdateSystemConfig} className="space-y-6">
                    {/* Background Settings */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 bg-blue-50 px-3 py-2 rounded-t-lg">
                        🖼️ Fondo de Página
                      </h3>
                      <div className="bg-blue-50 p-4 rounded-b-lg space-y-4">
                        <div className="space-y-2">
                          <label htmlFor="background-image-url" className="block text-sm font-medium text-gray-700">
                            URL de Imagen de Fondo
                          </label>
                          <Input
                            id="background-image-url"
                            value={systemConfig.backgroundImageUrl}
                            onChange={(e) => setSystemConfig({
                              ...systemConfig,
                              backgroundImageUrl: e.target.value
                            })}
                            placeholder="https://example.com/background.jpg"
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <label htmlFor="background-size" className="block text-sm font-medium text-gray-700">
                              Tamaño
                            </label>
                            <select
                              id="background-size"
                              value={systemConfig.backgroundSize}
                              onChange={(e) => setSystemConfig({
                                ...systemConfig,
                                backgroundSize: e.target.value as any
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="auto">Auto</option>
                              <option value="cover">Cubrir</option>
                              <option value="contain">Contener</option>
                              <option value="100% 100%">Estirar</option>
                            </select>
                          </div>
                          
                          <div className="space-y-2">
                            <label htmlFor="background-repeat" className="block text-sm font-medium text-gray-700">
                              Repetir
                            </label>
                            <select
                              id="background-repeat"
                              value={systemConfig.backgroundRepeat}
                              onChange={(e) => setSystemConfig({
                                ...systemConfig,
                                backgroundRepeat: e.target.value as any
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="no-repeat">No repetir</option>
                              <option value="repeat">Repetir</option>
                              <option value="repeat-x">Repetir X</option>
                              <option value="repeat-y">Repetir Y</option>
                            </select>
                          </div>
                          
                          <div className="space-y-2">
                            <label htmlFor="background-position" className="block text-sm font-medium text-gray-700">
                              Posición
                            </label>
                            <select
                              id="background-position"
                              value={systemConfig.backgroundPosition}
                              onChange={(e) => setSystemConfig({
                                ...systemConfig,
                                backgroundPosition: e.target.value as any
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="center">Centro</option>
                              <option value="top">Arriba</option>
                              <option value="bottom">Abajo</option>
                              <option value="left">Izquierda</option>
                              <option value="right">Derecha</option>
                              <option value="top left">Arriba Izquierda</option>
                              <option value="top right">Arriba Derecha</option>
                              <option value="bottom left">Abajo Izquierda</option>
                              <option value="bottom right">Abajo Derecha</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Login Page Images */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 bg-green-50 px-3 py-2 rounded-t-lg">
                        🔐 Imágenes de Páginas de Acceso
                      </h3>
                      <div className="bg-green-50 p-4 rounded-b-lg space-y-4">
                        <div className="space-y-2">
                          <label htmlFor="login-logo-url" className="block text-sm font-medium text-gray-700">
                            Logo de Página de Login
                          </label>
                          <Input
                            id="login-logo-url"
                            value={systemConfig.loginLogoImageUrl}
                            onChange={(e) => setSystemConfig({
                              ...systemConfig,
                              loginLogoImageUrl: e.target.value
                            })}
                            placeholder="https://example.com/login-logo.png"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label htmlFor="registration-image-url" className="block text-sm font-medium text-gray-700">
                            Imagen de Página de Registro
                          </label>
                          <Input
                            id="registration-image-url"
                            value={systemConfig.registrationImageUrl}
                            onChange={(e) => setSystemConfig({
                              ...systemConfig,
                              registrationImageUrl: e.target.value
                            })}
                            placeholder="https://example.com/registration-image.png"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label htmlFor="preload-image-url" className="block text-sm font-medium text-gray-700">
                            Imagen de Carga (Preload)
                          </label>
                          <Input
                            id="preload-image-url"
                            value={systemConfig.preloadImageUrl}
                            onChange={(e) => setSystemConfig({
                              ...systemConfig,
                              preloadImageUrl: e.target.value
                            })}
                            placeholder="https://example.com/preload-image.png"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Header and Footer Images */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 bg-yellow-50 px-3 py-2 rounded-t-lg">
                        🎯 Logos y Elementos de Interfaz
                      </h3>
                      <div className="bg-yellow-50 p-4 rounded-b-lg space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label htmlFor="header-logo-url" className="block text-sm font-medium text-gray-700">
                              Logo del Header
                            </label>
                            <Input
                              id="header-logo-url"
                              value={systemConfig.headerLogoImageUrl}
                              onChange={(e) => setSystemConfig({
                                ...systemConfig,
                                headerLogoImageUrl: e.target.value
                              })}
                              placeholder="https://example.com/header-logo.png"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label htmlFor="header-logo-size" className="block text-sm font-medium text-gray-700">
                              Tamaño del Logo del Header (px)
                            </label>
                            <Input
                              id="header-logo-size"
                              type="number"
                              min="16"
                              max="128"
                              value={systemConfig.headerLogoSize}
                              onChange={(e) => setSystemConfig({
                                ...systemConfig,
                                headerLogoSize: parseInt(e.target.value)
                              })}
                              placeholder="32"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <label htmlFor="footer-logo-url" className="block text-sm font-medium text-gray-700">
                            Logo del Footer
                          </label>
                          <Input
                            id="footer-logo-url"
                            value={systemConfig.footerLogoUrl}
                            onChange={(e) => setSystemConfig({
                              ...systemConfig,
                              footerLogoUrl: e.target.value
                            })}
                            placeholder="https://example.com/footer-logo.png"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Banner and Site Map Images */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 bg-purple-50 px-3 py-2 rounded-t-lg">
                        🏷️ Banner y Mapa del Sitio
                      </h3>
                      <div className="bg-purple-50 p-4 rounded-b-lg space-y-4">
                        <div className="space-y-2">
                          <label htmlFor="cobranding-image-url" className="block text-sm font-medium text-gray-700">
                            Imagen de Banner/Cobranding
                          </label>
                          <Input
                            id="cobranding-image-url"
                            value={systemConfig.cobrandingImageUrl}
                            onChange={(e) => setSystemConfig({
                              ...systemConfig,
                              cobrandingImageUrl: e.target.value
                            })}
                            placeholder="https://example.com/banner.png"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label htmlFor="site-map-image-url" className="block text-sm font-medium text-gray-700">
                            Imagen del Mapa del Sitio
                          </label>
                          <Input
                            id="site-map-image-url"
                            value={systemConfig.siteMapImageUrl}
                            onChange={(e) => setSystemConfig({
                              ...systemConfig,
                              siteMapImageUrl: e.target.value
                            })}
                            placeholder="https://example.com/site-map.png"
                          />
                        </div>
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Actualizando...
                        </>
                      ) : (
                        "Actualizar Configuración de Imágenes"
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="colors" className="space-y-6">
                  <form onSubmit={handleUpdateSystemConfig} className="space-y-6">
                    {/* Gradient Color Configuration */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 bg-gradient-to-r from-pink-50 to-purple-50 px-3 py-2 rounded-t-lg">
                        🎨 Configuración de Gradiente de Fondo
                      </h3>
                      <div className="bg-gradient-to-r from-pink-50 to-purple-50 p-4 rounded-b-lg space-y-4">
                        {/* Live Preview */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Vista Previa del Gradiente
                          </label>
                          <div 
                            className="h-20 w-full rounded-lg border-2 border-gray-200"
                            style={{
                              background: systemConfig.gradientType === 'linear' 
                                ? `linear-gradient(${systemConfig.gradientDirection}, ${systemConfig.gradientStartColor}${systemConfig.gradientMidColor ? `, ${systemConfig.gradientMidColor}` : ''}, ${systemConfig.gradientEndColor})`
                                : `radial-gradient(circle, ${systemConfig.gradientStartColor}${systemConfig.gradientMidColor ? `, ${systemConfig.gradientMidColor}` : ''}, ${systemConfig.gradientEndColor})`
                            }}
                          />
                        </div>

                        {/* Gradient Type Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label htmlFor="gradient-type" className="block text-sm font-medium text-gray-700">
                              Tipo de Gradiente
                            </label>
                            <select
                              id="gradient-type"
                              value={systemConfig.gradientType}
                              onChange={(e) => setSystemConfig({
                                ...systemConfig,
                                gradientType: e.target.value as any
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="linear">Lineal</option>
                              <option value="radial">Radial</option>
                            </select>
                          </div>

                          {/* Gradient Direction - only for linear */}
                          {systemConfig.gradientType === 'linear' && (
                            <div className="space-y-2">
                              <label htmlFor="gradient-direction" className="block text-sm font-medium text-gray-700">
                                Dirección del Gradiente
                              </label>
                              <select
                                id="gradient-direction"
                                value={systemConfig.gradientDirection}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  gradientDirection: e.target.value
                                })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="0deg">Hacia Arriba (0°)</option>
                                <option value="90deg">Hacia Derecha (90°)</option>
                                <option value="180deg">Hacia Abajo (180°)</option>
                                <option value="270deg">Hacia Izquierda (270°)</option>
                                <option value="45deg">Diagonal Superior Derecha (45°)</option>
                                <option value="135deg">Diagonal Inferior Derecha (135°)</option>
                                <option value="225deg">Diagonal Inferior Izquierda (225°)</option>
                                <option value="315deg">Diagonal Superior Izquierda (315°)</option>
                                <option value="175deg">Personalizado (175°)</option>
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Color Pickers */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <label htmlFor="gradient-start-color" className="block text-sm font-medium text-gray-700">
                              Color Inicial
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                id="gradient-start-color"
                                type="color"
                                value={systemConfig.gradientStartColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  gradientStartColor: e.target.value
                                })}
                                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={systemConfig.gradientStartColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  gradientStartColor: e.target.value
                                })}
                                placeholder="#bb2558"
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label htmlFor="gradient-mid-color" className="block text-sm font-medium text-gray-700">
                              Color Intermedio (Opcional)
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                id="gradient-mid-color"
                                type="color"
                                value={systemConfig.gradientMidColor || '#ffffff'}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  gradientMidColor: e.target.value
                                })}
                                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={systemConfig.gradientMidColor || ''}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  gradientMidColor: e.target.value
                                })}
                                placeholder="#ffffff (opcional)"
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label htmlFor="gradient-end-color" className="block text-sm font-medium text-gray-700">
                              Color Final
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                id="gradient-end-color"
                                type="color"
                                value={systemConfig.gradientEndColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  gradientEndColor: e.target.value
                                })}
                                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={systemConfig.gradientEndColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  gradientEndColor: e.target.value
                                })}
                                placeholder="#e8cf00"
                                className="flex-1"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Gradient Quick Presets */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Presets de Gradiente
                          </label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSystemConfig({
                                ...systemConfig,
                                gradientStartColor: '#bb2558',
                                gradientMidColor: '',
                                gradientEndColor: '#e8cf00',
                                gradientType: 'linear',
                                gradientDirection: '175deg'
                              })}
                              className="h-8 text-xs"
                            >
                              Predeterminado
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSystemConfig({
                                ...systemConfig,
                                gradientStartColor: '#667eea',
                                gradientMidColor: '',
                                gradientEndColor: '#764ba2',
                                gradientType: 'linear',
                                gradientDirection: '135deg'
                              })}
                              className="h-8 text-xs"
                            >
                              Azul-Púrpura
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSystemConfig({
                                ...systemConfig,
                                gradientStartColor: '#f093fb',
                                gradientMidColor: '',
                                gradientEndColor: '#f5576c',
                                gradientType: 'linear',
                                gradientDirection: '90deg'
                              })}
                              className="h-8 text-xs"
                            >
                              Rosa
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSystemConfig({
                                ...systemConfig,
                                gradientStartColor: '#4facfe',
                                gradientMidColor: '',
                                gradientEndColor: '#00f2fe',
                                gradientType: 'linear',
                                gradientDirection: '180deg'
                              })}
                              className="h-8 text-xs"
                            >
                              Cian
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Background Image Configuration */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 bg-green-50 px-3 py-2 rounded-t-lg">
                        🖼️ Configuración de Imagen de Fondo
                      </h3>
                      <div className="bg-green-50 p-4 rounded-b-lg space-y-4">
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
                            placeholder="https://ejemplo.com/textura.png"
                          />
                          <p className="text-xs text-gray-500">
                            URL de una imagen de textura que se aplicará sobre el gradiente
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <label htmlFor="background-size" className="block text-sm font-medium text-gray-700">
                              Tamaño de Imagen
                            </label>
                            <select
                              id="background-size"
                              value={systemConfig.backgroundSize}
                              onChange={(e) => setSystemConfig({
                                ...systemConfig,
                                backgroundSize: e.target.value as any
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="auto">Automático</option>
                              <option value="cover">Cubrir (Cover)</option>
                              <option value="contain">Contener (Contain)</option>
                              <option value="100%">100% Ancho</option>
                              <option value="50%">50% Ancho</option>
                              <option value="200px">200px</option>
                              <option value="300px">300px</option>
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label htmlFor="background-repeat" className="block text-sm font-medium text-gray-700">
                              Repetición
                            </label>
                            <select
                              id="background-repeat"
                              value={systemConfig.backgroundRepeat}
                              onChange={(e) => setSystemConfig({
                                ...systemConfig,
                                backgroundRepeat: e.target.value as any
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="repeat">Repetir (Repeat)</option>
                              <option value="no-repeat">No Repetir</option>
                              <option value="repeat-x">Repetir Horizontal</option>
                              <option value="repeat-y">Repetir Vertical</option>
                              <option value="round">Redondear (Round)</option>
                              <option value="space">Espaciar (Space)</option>
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label htmlFor="background-position" className="block text-sm font-medium text-gray-700">
                              Posición
                            </label>
                            <select
                              id="background-position"
                              value={systemConfig.backgroundPosition}
                              onChange={(e) => setSystemConfig({
                                ...systemConfig,
                                backgroundPosition: e.target.value as any
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="center">Centro</option>
                              <option value="top">Arriba</option>
                              <option value="bottom">Abajo</option>
                              <option value="left">Izquierda</option>
                              <option value="right">Derecha</option>
                              <option value="top left">Arriba Izquierda</option>
                              <option value="top right">Arriba Derecha</option>
                              <option value="bottom left">Abajo Izquierda</option>
                              <option value="bottom right">Abajo Derecha</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Combined Preview */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 bg-yellow-50 px-3 py-2 rounded-t-lg">
                        👁️ Vista Previa Combinada
                      </h3>
                      <div className="bg-yellow-50 p-4 rounded-b-lg">
                        <div 
                          className="h-32 w-full rounded-lg border-2 border-gray-200 flex items-center justify-center"
                          style={{
                            background: systemConfig.gradientType === 'linear' 
                              ? `linear-gradient(${systemConfig.gradientDirection}, ${systemConfig.gradientStartColor}${systemConfig.gradientMidColor ? `, ${systemConfig.gradientMidColor}` : ''}, ${systemConfig.gradientEndColor})`
                              : `radial-gradient(circle, ${systemConfig.gradientStartColor}${systemConfig.gradientMidColor ? `, ${systemConfig.gradientMidColor}` : ''}, ${systemConfig.gradientEndColor})`,
                            backgroundImage: systemConfig.backgroundImageUrl ? `url(${systemConfig.backgroundImageUrl})` : 'none',
                            backgroundSize: systemConfig.backgroundSize,
                            backgroundRepeat: systemConfig.backgroundRepeat,
                            backgroundPosition: systemConfig.backgroundPosition
                          }}
                        >
                          <div className="bg-white/80 px-4 py-2 rounded-lg text-sm font-medium text-gray-800">
                            Vista Previa del Fondo Final
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Esta es una vista previa de cómo se verá el fondo con el gradiente y la imagen de textura combinados
                        </p>
                      </div>
                    </div>

                    {/* Text Colors Configuration */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 bg-blue-50 px-3 py-2 rounded-t-lg">
                        🔤 Configuración de Colores de Texto
                      </h3>
                      <div className="bg-blue-50 p-4 rounded-b-lg space-y-4">
                        {/* Preview Section */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Vista Previa de Colores de Texto
                          </label>
                          <div className="space-y-4 p-4 bg-white rounded-lg border-2 border-gray-200">
                            {/* Header Preview */}
                            <div 
                              className="rounded-lg p-3 shadow-sm"
                              style={{ 
                                backgroundColor: systemConfig.headerBackgroundColor,
                                color: systemConfig.headerTextColor 
                              }}
                            >
                              <div className="flex justify-between items-center">
                                <div className="text-sm font-medium">Vista Previa del Header</div>
                                <div className="text-xs opacity-80">Usuario: John Doe</div>
                              </div>
                            </div>

                            {/* Content Preview */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <h4 style={{ color: systemConfig.titleTextColor }} className="text-xl font-bold">
                                  Título Principal
                                </h4>
                                <p style={{ color: systemConfig.primaryTextColor }} className="text-base">
                                  Texto principal del contenido
                                </p>
                                <p style={{ color: systemConfig.secondaryTextColor }} className="text-sm">
                                  Texto secundario o descripción
                                </p>
                                <a href="#" style={{ color: systemConfig.linkTextColor }} className="text-sm underline">
                                  Enlace de ejemplo
                                </a>
                              </div>
                              <div className="space-y-2">
                                <button 
                                  style={{ 
                                    backgroundColor: systemConfig.gradientStartColor, 
                                    color: systemConfig.buttonTextColor 
                                  }} 
                                  className="px-4 py-2 rounded text-sm font-medium"
                                >
                                  Botón de Ejemplo
                                </button>
                                <div className="space-y-1">
                                  <p style={{ color: systemConfig.successTextColor }} className="text-sm">
                                    ✓ Mensaje de éxito
                                  </p>
                                  <p style={{ color: systemConfig.warningTextColor }} className="text-sm">
                                    ⚠ Mensaje de advertencia
                                  </p>
                                  <p style={{ color: systemConfig.errorTextColor }} className="text-sm">
                                    ✗ Mensaje de error
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Primary Text Colors */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label htmlFor="title-text-color" className="block text-sm font-medium text-gray-700">
                              Color de Títulos
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                id="title-text-color"
                                type="color"
                                value={systemConfig.titleTextColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  titleTextColor: e.target.value
                                })}
                                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={systemConfig.titleTextColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  titleTextColor: e.target.value
                                })}
                                placeholder="#111827"
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label htmlFor="primary-text-color" className="block text-sm font-medium text-gray-700">
                              Color de Texto Principal
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                id="primary-text-color"
                                type="color"
                                value={systemConfig.primaryTextColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  primaryTextColor: e.target.value
                                })}
                                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={systemConfig.primaryTextColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  primaryTextColor: e.target.value
                                })}
                                placeholder="#1a1a1a"
                                className="flex-1"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label htmlFor="secondary-text-color" className="block text-sm font-medium text-gray-700">
                              Color de Texto Secundario
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                id="secondary-text-color"
                                type="color"
                                value={systemConfig.secondaryTextColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  secondaryTextColor: e.target.value
                                })}
                                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={systemConfig.secondaryTextColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  secondaryTextColor: e.target.value
                                })}
                                placeholder="#6b7280"
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label htmlFor="button-text-color" className="block text-sm font-medium text-gray-700">
                              Color de Texto de Botones
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                id="button-text-color"
                                type="color"
                                value={systemConfig.buttonTextColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  buttonTextColor: e.target.value
                                })}
                                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={systemConfig.buttonTextColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  buttonTextColor: e.target.value
                                })}
                                placeholder="#ffffff"
                                className="flex-1"
                              />
                            </div>
                          </div>
                        </div>

                        {/* UI Component Colors */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label htmlFor="header-background-color" className="block text-sm font-medium text-gray-700">
                              Color de Fondo del Header
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                id="header-background-color"
                                type="color"
                                value={systemConfig.headerBackgroundColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  headerBackgroundColor: e.target.value
                                })}
                                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={systemConfig.headerBackgroundColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  headerBackgroundColor: e.target.value
                                })}
                                placeholder="#3b82f6"
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label htmlFor="header-text-color" className="block text-sm font-medium text-gray-700">
                              Color de Texto del Header
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                id="header-text-color"
                                type="color"
                                value={systemConfig.headerTextColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  headerTextColor: e.target.value
                                })}
                                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={systemConfig.headerTextColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  headerTextColor: e.target.value
                                })}
                                placeholder="#ffffff"
                                className="flex-1"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Interactive and Status Colors */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label htmlFor="link-text-color" className="block text-sm font-medium text-gray-700">
                              Color de Enlaces
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                id="link-text-color"
                                type="color"
                                value={systemConfig.linkTextColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  linkTextColor: e.target.value
                                })}
                                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={systemConfig.linkTextColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  linkTextColor: e.target.value
                                })}
                                placeholder="#3b82f6"
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label htmlFor="success-text-color" className="block text-sm font-medium text-gray-700">
                              Color de Texto de Éxito
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                id="success-text-color"
                                type="color"
                                value={systemConfig.successTextColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  successTextColor: e.target.value
                                })}
                                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={systemConfig.successTextColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  successTextColor: e.target.value
                                })}
                                placeholder="#059669"
                                className="flex-1"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label htmlFor="warning-text-color" className="block text-sm font-medium text-gray-700">
                              Color de Texto de Advertencia
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                id="warning-text-color"
                                type="color"
                                value={systemConfig.warningTextColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  warningTextColor: e.target.value
                                })}
                                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={systemConfig.warningTextColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  warningTextColor: e.target.value
                                })}
                                placeholder="#d97706"
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label htmlFor="error-text-color" className="block text-sm font-medium text-gray-700">
                              Color de Texto de Error
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                id="error-text-color"
                                type="color"
                                value={systemConfig.errorTextColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  errorTextColor: e.target.value
                                })}
                                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={systemConfig.errorTextColor}
                                onChange={(e) => setSystemConfig({
                                  ...systemConfig,
                                  errorTextColor: e.target.value
                                })}
                                placeholder="#dc2626"
                                className="flex-1"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Quick Text Color Presets */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Presets de Colores de Texto
                          </label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSystemConfig({
                                ...systemConfig,
                                primaryTextColor: '#1a1a1a',
                                secondaryTextColor: '#6b7280',
                                titleTextColor: '#111827',
                                buttonTextColor: '#ffffff',
                                linkTextColor: '#3b82f6',
                                successTextColor: '#059669',
                                errorTextColor: '#dc2626',
                                warningTextColor: '#d97706',
                                headerBackgroundColor: '#3b82f6',
                                headerTextColor: '#ffffff'
                              })}
                              className="h-8 text-xs"
                            >
                              Predeterminado
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSystemConfig({
                                ...systemConfig,
                                primaryTextColor: '#f8fafc',
                                secondaryTextColor: '#cbd5e1',
                                titleTextColor: '#ffffff',
                                buttonTextColor: '#1e293b',
                                linkTextColor: '#60a5fa',
                                successTextColor: '#34d399',
                                errorTextColor: '#f87171',
                                warningTextColor: '#fbbf24',
                                headerBackgroundColor: '#1e293b',
                                headerTextColor: '#f8fafc'
                              })}
                              className="h-8 text-xs"
                            >
                              Modo Oscuro
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSystemConfig({
                                ...systemConfig,
                                primaryTextColor: '#374151',
                                secondaryTextColor: '#9ca3af',
                                titleTextColor: '#1f2937',
                                buttonTextColor: '#ffffff',
                                linkTextColor: '#6366f1',
                                successTextColor: '#10b981',
                                errorTextColor: '#ef4444',
                                warningTextColor: '#f59e0b',
                                headerBackgroundColor: '#6366f1',
                                headerTextColor: '#ffffff'
                              })}
                              className="h-8 text-xs"
                            >
                              Profesional
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSystemConfig({
                                ...systemConfig,
                                primaryTextColor: '#0f172a',
                                secondaryTextColor: '#64748b',
                                titleTextColor: '#020617',
                                buttonTextColor: '#f1f5f9',
                                linkTextColor: '#0ea5e9',
                                successTextColor: '#22c55e',
                                errorTextColor: '#e11d48',
                                warningTextColor: '#eab308',
                                headerBackgroundColor: '#020617',
                                headerTextColor: '#f1f5f9'
                              })}
                              className="h-8 text-xs"
                            >
                              Alto Contraste
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <Button type="submit" disabled={updatingConfig} className="w-full">
                      {updatingConfig ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Actualizando Configuración de Colores...
                        </>
                      ) : (
                        "Actualizar Configuración de Colores"
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="login" className="space-y-6">
                  <div className="text-center p-8 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Configuración de Página de Login</h3>
                    <p className="text-gray-600">La configuración de página de login estará disponible próximamente.</p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
    </Tabs>
    
    {/* Dialog para crear/editar sedes */}
    <Dialog open={venueDialogOpen} onOpenChange={setVenueDialogOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {venueDialogMode === "create" ? "Crear Nueva Sede" : "Editar Sede"}
          </DialogTitle>
          <DialogDescription>
            {venueDialogMode === "create" 
              ? "Ingresa los datos para crear una nueva sede" 
              : "Modifica los datos de la sede seleccionada"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="venue-name" className="text-sm font-medium">
              Nombre de la Sede*
            </label>
            <Input
              id="venue-name"
              placeholder="Ej: Sede Principal"
              value={venueFormData.name}
              onChange={(e) => setVenueFormData({
                ...venueFormData,
                name: e.target.value
              })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="venue-description" className="text-sm font-medium">
              Descripción
            </label>
            <Textarea
              id="venue-description"
              placeholder="Descripción opcional de la sede"
              value={venueFormData.description}
              onChange={(e) => setVenueFormData({
                ...venueFormData,
                description: e.target.value
              })}
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="venue-location" className="text-sm font-medium">
              Ubicación
            </label>
            <Input
              id="venue-location"
              placeholder="Ej: Bogotá, Colombia"
              value={venueFormData.location}
              onChange={(e) => setVenueFormData({
                ...venueFormData,
                location: e.target.value
              })}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="venue-max-participants" className="text-sm font-medium">
                Participantes Máx.
              </label>
              <Input
                id="venue-max-participants"
                type="number"
                placeholder="100"
                value={venueFormData.maxParticipants}
                onChange={(e) => setVenueFormData({
                  ...venueFormData,
                  maxParticipants: e.target.value ? parseInt(e.target.value) : undefined
                })}
                min="1"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <div className="flex items-center space-x-2 mt-2">
                <input
                  type="checkbox"
                  id="venue-active"
                  checked={venueFormData.isActive}
                  onChange={(e) => setVenueFormData({
                    ...venueFormData,
                    isActive: e.target.checked
                  })}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="venue-active" className="text-sm font-medium text-gray-700">
                  Sede Activa
                </label>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setVenueDialogOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={venueDialogMode === "create" ? handleVenueCreate : handleVenueUpdate}
            disabled={isLoading || !venueFormData.name.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {venueDialogMode === "create" ? "Creando..." : "Actualizando..."}
              </>
            ) : (
              venueDialogMode === "create" ? "Crear Sede" : "Actualizar Sede"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    </div>
  );
};

export default AdminPage;
