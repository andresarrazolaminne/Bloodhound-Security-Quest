import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BrainLoader from '../components/BrainLoader';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Download, Users, Clock, Globe, Calendar, Smartphone, ArrowRight, ChevronLeft, ChevronRight, FileDown } from 'lucide-react';
import { jsPDF } from "jspdf";
import { Link } from 'wouter';

// Define colores para los gráficos
const COLORS = ['#BB2558', '#E8CF00', '#1E88E5', '#43A047', '#7B1FA2', '#FB8C00', '#D81B60'];

// Interfaz para los datos de analítica
interface AnalyticsData {
  totalVisits: number;
  totalUsers: number;
  newUsers: number;
  returningUsers: number;
  devices?: Array<{name: string, value: number, percentage: number}>;
  countries?: Array<{name: string, value: number, percentage: number}>;
  visitsByDay: Array<{date: string, visits: number, uniqueUsers: number}>;
  deviceData: Array<{name: string, value: number}>;
  browserData: Array<{name: string, value: number}>;
  countryData: Array<{name: string, value: number}>;
  uniqueIPs?: number;
  avgSessionDuration?: string;
  bounceRate?: number;
  mostActiveHour?: string;
}

const InformeAnaliticaPage: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Formatear un número para mostrar en pantalla
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('es-CO').format(num);
  };
  
  // Formatear una fecha para mostrar en pantalla
  const formatDate = (dateStr: string): string => {
    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
    return new Date(dateStr).toLocaleDateString('es-ES', options);
  };
  
  // Obtener datos de analítica
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/admin/analitica');
        if (!response.ok) {
          throw new Error('Error al obtener datos de analítica');
        }
        const data = await response.json();
        setAnalyticsData(data);
      } catch (err) {
        console.error('Error:', err);
        setError('No se pudieron cargar los datos de analítica');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Función para exportar PDF
  const handleExportPDF = async () => {
    if (!analyticsData) return;
    
    try {
      // Crear nuevo documento PDF
      const doc = new jsPDF();
      
      // Cabecera colorida
      doc.setFillColor(187, 37, 88); // Color primario BB2558
      doc.rect(0, 0, 210, 35, 'F');
      
      // Barra decorativa
      doc.setFillColor(232, 207, 0); // Color secundario E8CF00
      doc.rect(0, 35, 210, 3, 'F');
      
      // Título
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text('INFORME DE ANALÍTICAS', 105, 20, {align: 'center'});
      doc.setFontSize(14);
      doc.text('SMARTFILMS 2025', 105, 28, {align: 'center'});
      
      // Fecha actual
      const fecha = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text(`Generado el: ${fecha}`, 105, 45, {align: 'center'});
      
      // Resumen general
      doc.setFontSize(16);
      doc.setTextColor(50, 50, 50);
      doc.text('RESUMEN GENERAL', 20, 60);
      
      // Datos principales
      doc.setFontSize(12);
      doc.setTextColor(80, 80, 80);
      doc.text(`Visitas totales: ${formatNumber(analyticsData.totalVisits)}`, 20, 70);
      doc.text(`Usuarios únicos: ${formatNumber(analyticsData.totalUsers)}`, 20, 78);
      doc.text(`Nuevos usuarios: ${formatNumber(analyticsData.newUsers)}`, 20, 86);
      doc.text(`Usuarios recurrentes: ${formatNumber(analyticsData.returningUsers)}`, 20, 94);
      
      // Datos adicionales
      if (analyticsData.avgSessionDuration) {
        doc.text(`Duración media de sesión: ${analyticsData.avgSessionDuration}`, 120, 70);
      }
      if (analyticsData.bounceRate) {
        doc.text(`Tasa de rebote: ${analyticsData.bounceRate}%`, 120, 78);
      }
      if (analyticsData.mostActiveHour) {
        doc.text(`Hora más activa: ${analyticsData.mostActiveHour}`, 120, 86);
      }
      if (analyticsData.uniqueIPs) {
        doc.text(`IPs únicas: ${formatNumber(analyticsData.uniqueIPs)}`, 120, 94);
      }
      
      // Línea separadora
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 100, 190, 100);
      
      // Dispositivos
      doc.setFontSize(16);
      doc.setTextColor(50, 50, 50);
      doc.text('DISPOSITIVOS', 20, 110);
      
      // Datos de dispositivos
      let y = 120;
      const devices = analyticsData.devices || analyticsData.deviceData;
      
      devices.forEach((device, index) => {
        if (index < 5) { // Limitar a 5
          const percentage = device.percentage || Math.round((device.value / analyticsData.totalVisits) * 100);
          
          // Dibujar barra base
          doc.setFillColor(220, 220, 220);
          doc.rect(80, y - 3, 70, 4, 'F');
          
          // Dibujar barra de progreso
          doc.setFillColor(187, 37, 88);
          doc.rect(80, y - 3, 70 * (percentage / 100), 4, 'F');
          
          // Texto
          doc.setFontSize(10);
          doc.setTextColor(80, 80, 80);
          doc.text(device.name, 20, y);
          doc.text(`${formatNumber(device.value)} (${percentage}%)`, 160, y);
          
          y += 10;
        }
      });
      
      // Línea separadora
      doc.setDrawColor(200, 200, 200);
      doc.line(20, y + 5, 190, y + 5);
      y += 15;
      
      // Países
      doc.setFontSize(16);
      doc.setTextColor(50, 50, 50);
      doc.text('PAÍSES', 20, y);
      y += 10;
      
      // Datos de países
      const countries = analyticsData.countries || analyticsData.countryData;
      
      countries.forEach((country, index) => {
        if (index < 5) { // Limitar a 5
          const percentage = country.percentage || Math.round((country.value / analyticsData.totalVisits) * 100);
          
          // Dibujar barra base
          doc.setFillColor(220, 220, 220);
          doc.rect(80, y - 3, 70, 4, 'F');
          
          // Dibujar barra de progreso
          doc.setFillColor(187, 37, 88);
          doc.rect(80, y - 3, 70 * (percentage / 100), 4, 'F');
          
          // Texto
          doc.setFontSize(10);
          doc.setTextColor(80, 80, 80);
          doc.text(country.name, 20, y);
          doc.text(`${formatNumber(country.value)} (${percentage}%)`, 160, y);
          
          y += 10;
        }
      });
      
      // Si necesitamos una segunda página
      if (y > 250) {
        doc.addPage();
        y = 20;
      } else {
        // Línea separadora
        doc.setDrawColor(200, 200, 200);
        doc.line(20, y + 5, 190, y + 5);
        y += 15;
      }
      
      // Navegadores
      doc.setFontSize(16);
      doc.setTextColor(50, 50, 50);
      doc.text('NAVEGADORES', 20, y);
      y += 10;
      
      // Datos de navegadores
      analyticsData.browserData.forEach((browser, index) => {
        if (index < 5) { // Limitar a 5
          const percentage = Math.round((browser.value / analyticsData.totalVisits) * 100);
          
          // Dibujar barra base
          doc.setFillColor(220, 220, 220);
          doc.rect(80, y - 3, 70, 4, 'F');
          
          // Dibujar barra de progreso
          doc.setFillColor(232, 207, 0); // Color secundario para variedad
          doc.rect(80, y - 3, 70 * (percentage / 100), 4, 'F');
          
          // Texto
          doc.setFontSize(10);
          doc.setTextColor(80, 80, 80);
          doc.text(browser.name, 20, y);
          doc.text(`${formatNumber(browser.value)} (${percentage}%)`, 160, y);
          
          y += 10;
        }
      });
      
      // Pie de página
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text('© Smartfilms 2025 - Informe generado automáticamente', 105, 285, {align: 'center'});
      
      // Guardar PDF
      doc.save('Smartfilms-Informe-Completo.pdf');
      
    } catch (error) {
      console.error('Error al generar PDF:', error);
      alert('Error al generar el informe PDF');
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <BrainLoader size="large" text="Cargando datos de analítica..." />
      </div>
    );
  }
  
  if (error || !analyticsData) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 text-red-800 rounded-lg p-6 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold mb-2">Error al cargar datos</h2>
          <p>{error || 'No se pudieron cargar los datos de analítica'}</p>
          <Button className="mt-4" variant="outline" asChild>
            <Link to="/admin">Volver al panel</Link>
          </Button>
        </div>
      </div>
    );
  }
  
  // Preparar datos para gráficos
  const visitsGraphData = analyticsData.visitsByDay.map(day => ({
    ...day,
    date: formatDate(day.date)
  }));
  
  // Calcular totales para dispositivos y países
  const totalDevices = analyticsData.deviceData.reduce((sum, device) => sum + device.value, 0);
  const deviceDataWithPercentage = analyticsData.deviceData.map(device => ({
    ...device,
    percentage: Math.round((device.value / totalDevices) * 100)
  }));
  
  const totalCountries = analyticsData.countryData.reduce((sum, country) => sum + country.value, 0);
  const countryDataWithPercentage = analyticsData.countryData.map(country => ({
    ...country,
    percentage: Math.round((country.value / totalCountries) * 100)
  }));
  
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Informe de Analítica</h1>
          <p className="text-gray-500">Datos completos del uso de la aplicación</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" className="flex items-center" asChild>
            <Link to="/admin">
              <ChevronLeft className="w-4 h-4 mr-1" /> Volver
            </Link>
          </Button>
          <Button onClick={handleExportPDF} className="flex items-center bg-primary">
            <FileDown className="w-4 h-4 mr-1" /> Exportar PDF
          </Button>
        </div>
      </div>
      
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500 font-medium">Visitas totales</p>
                <p className="text-3xl font-bold">{formatNumber(analyticsData.totalVisits)}</p>
              </div>
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-primary/10 text-primary">
                <Globe className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500 font-medium">Usuarios únicos</p>
                <p className="text-3xl font-bold">{formatNumber(analyticsData.totalUsers)}</p>
              </div>
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500 font-medium">{analyticsData.avgSessionDuration ? 'Tiempo promedio' : 'Nuevos usuarios'}</p>
                <p className="text-3xl font-bold">{analyticsData.avgSessionDuration || formatNumber(analyticsData.newUsers)}</p>
              </div>
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-primary/10 text-primary">
                {analyticsData.avgSessionDuration ? <Clock className="w-6 h-6" /> : <Users className="w-6 h-6" />}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500 font-medium">{analyticsData.bounceRate ? 'Tasa de rebote' : 'Usuarios recurrentes'}</p>
                <p className="text-3xl font-bold">{analyticsData.bounceRate ? `${analyticsData.bounceRate}%` : formatNumber(analyticsData.returningUsers)}</p>
              </div>
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-primary/10 text-primary">
                <ArrowRight className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Principal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Visitas por día */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Visitas por día</CardTitle>
            <CardDescription>Evolución de visitas y usuarios por día</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={visitsGraphData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="visits" stroke="#BB2558" activeDot={{ r: 8 }} name="Visitas" />
                <Line type="monotone" dataKey="uniqueUsers" stroke="#E8CF00" name="Usuarios únicos" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        {/* Distribución de dispositivos */}
        <Card>
          <CardHeader>
            <CardTitle>Dispositivos</CardTitle>
            <CardDescription>Distribución por tipo de dispositivo</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={deviceDataWithPercentage}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {deviceDataWithPercentage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [formatNumber(value as number), 'Usuarios']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs con más análisis */}
      <Tabs defaultValue="countries" className="mb-6">
        <TabsList className="mb-4">
          <TabsTrigger value="countries">Países</TabsTrigger>
          <TabsTrigger value="browsers">Navegadores</TabsTrigger>
          <TabsTrigger value="details">Detalles adicionales</TabsTrigger>
        </TabsList>
        
        {/* Tab de países */}
        <TabsContent value="countries" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Distribución por países</CardTitle>
              <CardDescription>Visitas clasificadas por ubicación geográfica</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={countryDataWithPercentage}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" />
                  <Tooltip formatter={(value) => [formatNumber(value as number), 'Visitas']} />
                  <Bar dataKey="value" fill="#BB2558">
                    {countryDataWithPercentage.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Tab de navegadores */}
        <TabsContent value="browsers" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Navegadores</CardTitle>
              <CardDescription>Distribución por navegador utilizado</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analyticsData.browserData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {analyticsData.browserData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip formatter={(value) => [formatNumber(value as number), 'Usuarios']} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Tab de detalles adicionales */}
        <TabsContent value="details" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Métricas avanzadas</CardTitle>
              <CardDescription>Información detallada sobre el comportamiento de usuarios</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Usuarios únicos</h3>
                  <p className="text-2xl font-bold">{formatNumber(analyticsData.totalUsers)}</p>
                  <p className="text-xs text-gray-500 mt-1">Total de dispositivos diferentes</p>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Direcciones IP</h3>
                  <p className="text-2xl font-bold">{formatNumber(analyticsData.uniqueIPs || 0)}</p>
                  <p className="text-xs text-gray-500 mt-1">IPs únicas detectadas</p>
                </div>
                
                {analyticsData.mostActiveHour && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Hora más activa</h3>
                    <p className="text-2xl font-bold">{analyticsData.mostActiveHour}</p>
                    <p className="text-xs text-gray-500 mt-1">Mayor actividad registrada</p>
                  </div>
                )}
                
                {analyticsData.bounceRate && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Tasa de rebote</h3>
                    <p className="text-2xl font-bold">{analyticsData.bounceRate}%</p>
                    <p className="text-xs text-gray-500 mt-1">Usuarios que salen sin interactuar</p>
                  </div>
                )}
              </div>
              
              <div className="mt-8">
                <h3 className="text-lg font-medium mb-3">Distribución de usuarios</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Nuevos vs. Recurrentes</h4>
                    <div className="flex items-center mb-2">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-primary h-2.5 rounded-full" style={{ width: `${Math.round((analyticsData.newUsers / analyticsData.totalUsers) * 100)}%` }}></div>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Nuevos: {formatNumber(analyticsData.newUsers)} ({Math.round((analyticsData.newUsers / analyticsData.totalUsers) * 100)}%)</span>
                      <span>Recurrentes: {formatNumber(analyticsData.returningUsers)} ({Math.round((analyticsData.returningUsers / analyticsData.totalUsers) * 100)}%)</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Dispositivos móviles vs. Escritorio</h4>
                    <div className="flex items-center mb-2">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-[#E8CF00] h-2.5 rounded-full" style={{ 
                          width: `${Math.round(((analyticsData.deviceData.find(d => d.name === 'Android')?.value || 0) + 
                                              (analyticsData.deviceData.find(d => d.name === 'iOS')?.value || 0)) / 
                                             totalDevices * 100)}%` 
                        }}></div>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Móviles: {formatNumber((analyticsData.deviceData.find(d => d.name === 'Android')?.value || 0) + 
                                               (analyticsData.deviceData.find(d => d.name === 'iOS')?.value || 0))} 
                            ({Math.round(((analyticsData.deviceData.find(d => d.name === 'Android')?.value || 0) + 
                                         (analyticsData.deviceData.find(d => d.name === 'iOS')?.value || 0)) / 
                                        totalDevices * 100)}%)
                      </span>
                      <span>Escritorio: {formatNumber((analyticsData.deviceData.find(d => d.name === 'Windows')?.value || 0) + 
                                                 (analyticsData.deviceData.find(d => d.name === 'macOS')?.value || 0) +
                                                 (analyticsData.deviceData.find(d => d.name === 'Linux')?.value || 0))} 
                              ({Math.round(((analyticsData.deviceData.find(d => d.name === 'Windows')?.value || 0) + 
                                           (analyticsData.deviceData.find(d => d.name === 'macOS')?.value || 0) +
                                           (analyticsData.deviceData.find(d => d.name === 'Linux')?.value || 0)) / 
                                          totalDevices * 100)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-gray-50 border-t">
              <p className="text-sm text-gray-500">
                Datos recopilados en el periodo: mayo 2025
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Tabla de datos de dispositivos */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Dispositivos por tipo</CardTitle>
          <CardDescription>Detalle de accesos por plataforma</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left pb-3 font-medium text-gray-500">Dispositivo</th>
                  <th className="text-right pb-3 font-medium text-gray-500">Usuarios</th>
                  <th className="text-right pb-3 font-medium text-gray-500">Porcentaje</th>
                  <th className="text-left pb-3 font-medium text-gray-500">Distribución</th>
                </tr>
              </thead>
              <tbody>
                {deviceDataWithPercentage.map((device, index) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{device.name}</td>
                    <td className="py-3 text-right">{formatNumber(device.value)}</td>
                    <td className="py-3 text-right">{device.percentage}%</td>
                    <td className="py-3 pl-4">
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="h-1.5 rounded-full" 
                          style={{
                            width: `${device.percentage}%`,
                            backgroundColor: COLORS[index % COLORS.length]
                          }}
                        ></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {/* Información contextual */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-blue-800 font-medium mb-2">Notas sobre los datos</h3>
        <ul className="text-sm text-blue-700 list-disc pl-5 space-y-1">
          <li>Los datos presentados corresponden al periodo actual de mayo 2025.</li>
          <li>La distribución geográfica muestra una fuerte concentración en Colombia (95.6%).</li>
          <li>Los dispositivos Android son mayoritarios (76%) frente a iOS (23%).</li>
          <li>Se han detectado {formatNumber(analyticsData.uniqueIPs || analyticsData.totalUsers)} direcciones IP únicas.</li>
          <li>Este informe fue generado automáticamente por el sistema de analítica de Smartfilms 2025.</li>
        </ul>
      </div>
    </div>
  );
};

export default InformeAnaliticaPage;