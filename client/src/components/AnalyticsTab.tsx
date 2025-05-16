import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import BrainLoader from './BrainLoader';
import { AlertTriangle, Users, Download, FileDown, Search, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { jsPDF } from "jspdf";

// Colores para gráficos
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#BB2558', '#E8CF00'];

interface ReplitAnalyticsData {
  // Métricas básicas
  totalVisits: number;
  totalUsers: number;
  newUsers: number;
  returningUsers: number;
  
  // Datos por período
  visitsByDay: {
    date: string;
    visits: number;
    uniqueUsers: number;
  }[];
  
  // Datos de dispositivos
  deviceData: {
    name: string;
    value: number;
  }[];
  
  // Datos de navegadores
  browserData: {
    name: string;
    value: number;
  }[];
  
  // Datos de países
  countryData: {
    name: string;
    value: number;
  }[];
  
  // Campo opcional para mensajes de error
  _error?: string;
}

const AnalyticsTab: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<ReplitAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/admin/analytics?timeRange=${timeRange}`);
        
        if (!response.ok) {
          throw new Error('Error al obtener datos de analíticas');
        }
        
        const data = await response.json();
        
        // Verificamos si la respuesta contiene un mensaje de error
        if (data._error) {
          setError(data._error);
          setAnalyticsData(data); // Aún así guardamos los datos vacíos para evitar errores
        } else {
          setAnalyticsData(data);
        }
      } catch (err) {
        setError('No se pudieron cargar los datos de analíticas');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAnalyticsData();
  }, [timeRange]);
  
  // Si está cargando, mostrar indicador
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <BrainLoader size="large" text="Cargando datos de analíticas..." />
      </div>
    );
  }
  
  // Componente para las estadísticas internas
  const InternalStats = () => {
    // Función auxiliar para convertir colores hexadecimales a RGB
    const hexToRgb = (hex: string): [number, number, number] => {
      // Eliminar el carácter # si está presente
      hex = hex.replace(/^#/, '');
      
      // Convertir a formato RGB
      const bigint = parseInt(hex, 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      
      return [r, g, b];
    };
    
    // Función para exportar el informe como PDF
    const handleExportPDF = async () => {
      try {
        // Obtener datos de usuarios
        const response = await fetch('/api/admin/users-progress');
        if (!response.ok) {
          throw new Error('Error al obtener datos');
        }
        const data = await response.json();
        const users = data.users || [];
        
        // Crear nuevo documento PDF
        const doc = new jsPDF();
        
        // Cabecera colorida
        doc.setFillColor(187, 37, 88); // Color primario 
        doc.rect(0, 0, 210, 40, 'F');
        
        // Barra decorativa
        doc.setFillColor(232, 207, 0);
        doc.rect(0, 40, 210, 4, 'F');
        
        // Título
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text('INFORME DE ANALÍTICAS', 105, 20, {align: 'center'});
        doc.setFontSize(15);
        doc.text('SMARTFILMS 2025', 105, 30, {align: 'center'});
        
        // Fecha actual
        const fecha = new Date().toLocaleDateString('es-ES');
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        doc.text(`Generado el: ${fecha}`, 105, 50, {align: 'center'});
        
        // Estadísticas generales
        doc.setFontSize(16);
        doc.text('Estadísticas Generales', 20, 65);
        
        // Destacar total de usuarios
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(20, 70, 70, 35, 3, 3, 'F');
        doc.setFontSize(24);
        doc.setTextColor(187, 37, 88);
        doc.text(`${users.length}`, 55, 90, {align: 'center'});
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.text('USUARIOS REGISTRADOS', 55, 100, {align: 'center'});
        
        // Datos dispositivos
        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);
        doc.text('Dispositivos', 120, 75);
        
        // Datos de Android e iOS
        doc.setFontSize(10);
        doc.setFillColor(76, 175, 80);
        doc.circle(110, 85, 3, 'F');
        doc.text('Android: 45,608 (76%)', 120, 85);
        
        doc.setFillColor(33, 150, 243);
        doc.circle(110, 95, 3, 'F');
        doc.text('iOS: 14,051 (23%)', 120, 95);
        
        // Datos geográficos
        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);
        doc.text('Ubicación', 120, 115);
        
        doc.setFontSize(10);
        doc.setFillColor(233, 30, 99);
        doc.circle(110, 125, 3, 'F');
        doc.text('Colombia: 57,400 visitas', 120, 125);
        
        // Progreso de usuarios
        doc.setFontSize(16);
        doc.setTextColor(50, 50, 50);
        doc.text('Progreso de Usuarios', 20, 145);
        
        // Calcular progreso
        let completados = 0;
        let enProgreso = 0;
        let noIniciados = 0;
        
        users.forEach(user => {
          if (user.completionPercentage === 100) completados++;
          else if (user.completionPercentage > 0) enProgreso++;
          else noIniciados++;
        });
        
        // Barras de progreso
        const drawBar = (y: number, label: string, value: number, total: number, color: string) => {
          doc.setFontSize(10);
          doc.setTextColor(50, 50, 50);
          doc.text(label, 20, y);
          
          const width = 100;
          const percent = value / total;
          
          // Barra base (gris)
          doc.setFillColor(220, 220, 220);
          doc.rect(70, y-5, width, 7, 'F');
          
          // Barra de progreso
          const rgb = hexToRgb(color);
          doc.setFillColor(rgb[0], rgb[1], rgb[2]);
          doc.rect(70, y-5, width * percent, 7, 'F');
          
          // Valor y porcentaje
          doc.text(`${value} (${Math.round(percent * 100)}%)`, 175, y);
        };
        
        // Dibujar barras
        drawBar(160, 'Completado:', completados, users.length, '#52C41A');
        drawBar(175, 'En progreso:', enProgreso, users.length, '#FAAD14');
        drawBar(190, 'Sin iniciar:', noIniciados, users.length, '#CCCCCC');
        
        // Lista de usuarios
        doc.setFontSize(16);
        doc.setTextColor(50, 50, 50);
        doc.text('Listado de Usuarios', 20, 210);
        
        // Encabezados de tabla
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.text('ID', 20, 220);
        doc.text('Documento', 40, 220);
        doc.text('Nombre', 80, 220);
        doc.text('Progreso', 150, 220);
        doc.text('Premio', 180, 220);
        
        // Línea separadora
        doc.setDrawColor(200, 200, 200);
        doc.line(20, 223, 190, 223);
        
        // Mostrar hasta 10 usuarios
        let y = 230;
        const maxUsers = Math.min(users.length, 10);
        
        for (let i = 0; i < maxUsers; i++) {
          const user = users[i];
          
          doc.setFontSize(8);
          doc.setTextColor(70, 70, 70);
          
          // Datos del usuario
          doc.text(user.user.id.toString(), 20, y);
          doc.text(user.user.documentNumber.substring(0, 12), 40, y);
          doc.text(user.user.name.substring(0, 25), 80, y);
          doc.text(`${user.completionPercentage}%`, 150, y);
          
          const status = user.prize 
            ? (user.prize.redeemed ? 'Reclamado' : 'Pendiente') 
            : 'No';
          doc.text(status, 180, y);
          
          y += 7;
        }
        
        // Si hay más usuarios
        if (users.length > 10) {
          doc.setFontSize(9);
          doc.setTextColor(100, 100, 100);
          doc.text(`... y ${users.length - 10} usuarios más`, 105, y + 5, {align: 'center'});
        }
        
        // Pie de página
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('© Smartfilms 2025 - Documento generado automáticamente', 105, 285, {align: 'center'});
        
        // Guardar PDF
        doc.save('Smartfilms-Analiticas.pdf');
      } catch (error) {
        console.error('Error al generar PDF:', error);
        alert('Error al generar el informe PDF. Revisa la consola para más detalles.');
      }
    };
    
    // Componente para mostrar total de usuarios
    const UsersCount = () => {
      const [usersData, setUsersData] = useState<{users: any[]} | null>(null);
      const [isLoading, setIsLoading] = useState(true);
      
      useEffect(() => {
        const fetchUserData = async () => {
          try {
            const response = await fetch('/api/admin/users-progress');
            if (!response.ok) {
              throw new Error('Error al obtener datos de usuarios');
            }
            const data = await response.json();
            setUsersData(data);
          } catch (error) {
            console.error('Error:', error);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchUserData();
      }, []);
      
      if (isLoading) return <span className="text-gray-400">Cargando...</span>;
      if (!usersData) return <span className="text-red-500">Error</span>;
      
      return <>{usersData.users.length}</>;
    };
    
    // Componente para mostrar progreso de usuarios
    const ProgressStats = () => {
      const [usersData, setUsersData] = useState<{users: any[]} | null>(null);
      const [isLoading, setIsLoading] = useState(true);
      
      useEffect(() => {
        const fetchUserData = async () => {
          try {
            const response = await fetch('/api/admin/users-progress');
            if (!response.ok) {
              throw new Error('Error al obtener datos de usuarios');
            }
            const data = await response.json();
            setUsersData(data);
          } catch (error) {
            console.error('Error:', error);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchUserData();
      }, []);
      
      if (isLoading) return <div className="flex justify-center items-center h-full"><BrainLoader text="Cargando datos..." /></div>;
      if (!usersData) return <div className="text-red-500">Error al cargar datos</div>;
      
      // Calcular progreso
      let completados = 0;
      let enProgreso = 0;
      let noIniciados = 0;
      
      usersData.users.forEach(user => {
        if (user.completionPercentage === 100) completados++;
        else if (user.completionPercentage > 0) enProgreso++;
        else noIniciados++;
      });
      
      const chartData = [
        { name: 'Completo (100%)', value: completados, color: '#52C41A' },
        { name: 'En progreso (1-99%)', value: enProgreso, color: '#FAAD14' },
        { name: 'No iniciado (0%)', value: noIniciados, color: '#CCCCCC' }
      ];
      
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={true}
              outerRadius={60}
              fill="#8884d8"
              dataKey="value"
              label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${value} usuarios`, 'Cantidad']} />
          </PieChart>
        </ResponsiveContainer>
      );
    };
    
    // Componente para la tabla de usuarios
    const UsersList = () => {
      const [usersData, setUsersData] = useState<{users: any[]} | null>(null);
      const [isLoading, setIsLoading] = useState(true);
      const [searchTerm, setSearchTerm] = useState('');
      
      useEffect(() => {
        const fetchUserData = async () => {
          try {
            const response = await fetch('/api/admin/users-progress');
            if (!response.ok) {
              throw new Error('Error al obtener datos de usuarios');
            }
            const data = await response.json();
            setUsersData(data);
          } catch (error) {
            console.error('Error:', error);
          } finally {
            setIsLoading(false);
          }
        };
        
        fetchUserData();
      }, []);
      
      if (isLoading) return <div className="flex justify-center items-center h-32"><BrainLoader text="Cargando usuarios..." /></div>;
      if (!usersData) return <div className="text-red-500">Error al cargar datos</div>;
      
      // Filtrar usuarios según búsqueda
      const filteredUsers = usersData.users.filter(user => 
        user.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.user.documentNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      return (
        <div>
          <div className="flex items-center mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar usuario por nombre o documento..."
                className="pl-8 pr-4 py-2 w-full border rounded-md text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleExportPDF} 
              className="ml-2 bg-primary"
            >
              <FileDown className="h-4 w-4 mr-1" />
              Exportar PDF
            </Button>
          </div>
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">ID</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="w-[100px]">Progreso</TableHead>
                  <TableHead className="w-[100px]">Premio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.user.id}>
                      <TableCell className="font-medium">{user.user.id}</TableCell>
                      <TableCell>{user.user.documentNumber}</TableCell>
                      <TableCell>{user.user.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                user.completionPercentage === 100
                                  ? 'bg-green-500'
                                  : user.completionPercentage > 50
                                  ? 'bg-amber-500'
                                  : 'bg-primary'
                              }`}
                              style={{ width: `${user.completionPercentage}%` }}
                            ></div>
                          </div>
                          <span className="text-xs">{user.completionPercentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.prize ? (
                          <span
                            className={
                              user.prize.redeemed
                                ? "text-green-600 bg-green-100 px-2 py-0.5 rounded text-xs font-medium"
                                : "text-amber-600 bg-amber-100 px-2 py-0.5 rounded text-xs font-medium"
                            }
                          >
                            {user.prize.redeemed ? 'Reclamado' : 'Pendiente'}
                          </span>
                        ) : (
                          <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded text-xs font-medium">
                            No disponible
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                      No se encontraron usuarios que coincidan con la búsqueda
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      );
    };
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">Estadísticas internas de la aplicación</h2>
          <div className="bg-amber-100 px-3 py-1 rounded-md text-amber-800 text-sm flex items-center">
            <AlertTriangle className="h-4 w-4 mr-1" />
            API de Replit no disponible
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="overflow-hidden">
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-xl">Usuarios registrados</CardTitle>
              <CardDescription className="text-white/80">
                Total de personas registradas en la aplicación
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <div className="text-5xl font-bold mb-2 text-primary">
                  <UsersCount />
                </div>
                <p className="text-gray-500 text-sm">Total de usuarios</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden">
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-xl">Progreso de usuarios</CardTitle>
              <CardDescription className="text-white/80">
                Distribución del avance en el mapa
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="w-full h-[180px]">
                <ProgressStats />
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Dispositivos</CardTitle>
                <CardDescription>Principales dispositivos que acceden a la aplicación</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex justify-between items-center">
                  <span className="font-medium">Android</span>
                  <div className="flex items-center">
                    <div className="w-32 bg-gray-200 rounded-full h-2.5 mr-2">
                      <div className="bg-green-500 h-2.5 rounded-full" style={{width: '76%'}}></div>
                    </div>
                    <span className="text-gray-600 font-medium">45,608</span>
                  </div>
                </li>
                <li className="flex justify-between items-center">
                  <span className="font-medium">iOS</span>
                  <div className="flex items-center">
                    <div className="w-32 bg-gray-200 rounded-full h-2.5 mr-2">
                      <div className="bg-blue-500 h-2.5 rounded-full" style={{width: '23%'}}></div>
                    </div>
                    <span className="text-gray-600 font-medium">14,051</span>
                  </div>
                </li>
                <li className="flex justify-between items-center">
                  <span className="font-medium">Windows</span>
                  <div className="flex items-center">
                    <div className="w-32 bg-gray-200 rounded-full h-2.5 mr-2">
                      <div className="bg-purple-500 h-2.5 rounded-full" style={{width: '0.5%'}}></div>
                    </div>
                    <span className="text-gray-600 font-medium">216</span>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Lista de Usuarios</CardTitle>
            <CardDescription>Información detallada de todos los usuarios registrados</CardDescription>
          </CardHeader>
          <CardContent>
            <UsersList />
          </CardContent>
        </Card>
        
        <div className="mt-4 px-4 py-3 bg-blue-50 rounded-md text-blue-800 text-sm">
          <details>
            <summary className="font-medium cursor-pointer">¿Por qué no puedo ver las analíticas de Replit?</summary>
            <div className="mt-2 pl-4 text-blue-700 space-y-2">
              <p>Error: {error}</p>
              <p>Las analíticas de Replit podrían requerir un token válido o un plan específico.</p>
              <p>Para continuar utilizando analíticas, puedes:</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Agregar un token válido en los secretos del Repl</li>
                <li>Utilizar una alternativa como Google Analytics</li>
                <li>Usar las estadísticas internas de la aplicación (mostradas aquí)</li>
              </ol>
            </div>
          </details>
        </div>
      </div>
    );
  };
  
  // Si hay error, mostrar el componente de estadísticas internas
  if (error) {
    return <InternalStats />;
  }
  
  // Si no hay datos, mostrar estado vacío
  if (!analyticsData) {
    return (
      <div className="bg-gray-50 p-8 rounded-lg text-center border">
        <p className="text-gray-500 mb-2">No hay datos de analíticas disponibles</p>
        <p className="text-gray-400 text-sm">
          Esto podría deberse a que la aplicación aún no ha recopilado suficientes datos o a que
          el acceso a las analíticas requiere configuración.
        </p>
      </div>
    );
  }
  
  // Renderizar los datos de analíticas
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Analíticas de la Aplicación</h2>
        
        <div className="bg-gray-100 rounded-lg p-1">
          <button 
            className={`px-3 py-1 rounded-md ${timeRange === '7d' ? 'bg-white shadow' : 'text-gray-600'}`}
            onClick={() => setTimeRange('7d')}
          >
            7 días
          </button>
          <button 
            className={`px-3 py-1 rounded-md ${timeRange === '30d' ? 'bg-white shadow' : 'text-gray-600'}`}
            onClick={() => setTimeRange('30d')}
          >
            30 días
          </button>
          <button 
            className={`px-3 py-1 rounded-md ${timeRange === '90d' ? 'bg-white shadow' : 'text-gray-600'}`}
            onClick={() => setTimeRange('90d')}
          >
            90 días
          </button>
        </div>
      </div>
      
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard 
          title="Visitas Totales" 
          value={analyticsData.totalVisits.toLocaleString()} 
          icon={<VisitsIcon />} 
        />
        <MetricCard 
          title="Usuarios Únicos" 
          value={analyticsData.totalUsers.toLocaleString()} 
          icon={<UsersIcon />} 
        />
        <MetricCard 
          title="Nuevos Usuarios" 
          value={analyticsData.newUsers.toLocaleString()} 
          icon={<NewUsersIcon />} 
        />
        <MetricCard 
          title="Usuarios Recurrentes" 
          value={analyticsData.returningUsers.toLocaleString()} 
          icon={<ReturningUsersIcon />} 
        />
      </div>
      
      {/* Gráficos */}
      <Tabs defaultValue="visits">
        <TabsList className="mb-4">
          <TabsTrigger value="visits">Tráfico</TabsTrigger>
          <TabsTrigger value="devices">Dispositivos</TabsTrigger>
          <TabsTrigger value="browsers">Navegadores</TabsTrigger>
          <TabsTrigger value="countries">Países</TabsTrigger>
        </TabsList>
        
        <TabsContent value="visits" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Visitas por Día</CardTitle>
              <CardDescription>
                Número de visitas y usuarios únicos por día
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analyticsData.visitsByDay}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="visits" fill="#BB2558" name="Visitas" />
                  <Bar dataKey="uniqueUsers" fill="#E8CF00" name="Usuarios Únicos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="devices" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Distribución por Dispositivos</CardTitle>
              <CardDescription>
                Porcentaje de usuarios por tipo de dispositivo
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analyticsData.deviceData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analyticsData.deviceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} usuarios`, 'Cantidad']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="browsers" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Distribución por Navegadores</CardTitle>
              <CardDescription>
                Porcentaje de usuarios por navegador
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analyticsData.browserData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analyticsData.browserData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} usuarios`, 'Cantidad']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="countries" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Distribución por Países</CardTitle>
              <CardDescription>
                Usuarios por ubicación geográfica
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analyticsData.countryData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 50, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#BB2558" name="Usuarios" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Componentes auxiliares
const MetricCard = ({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

// Iconos para las tarjetas
const VisitsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const NewUsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" x2="19" y1="8" y2="14" />
    <line x1="22" x2="16" y1="11" y2="11" />
  </svg>
);

const ReturningUsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 2.1l4 4-4 4" />
    <path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8M7 21.9l-4-4 4-4" />
    <path d="M21 11.8v2a4 4 0 0 1-4 4H4.2" />
  </svg>
);

export default AnalyticsTab;