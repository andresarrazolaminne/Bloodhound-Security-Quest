import fetch from 'node-fetch';

/**
 * Interfaz para los datos de analíticas de Replit
 */
export interface ReplitAnalyticsData {
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
  // (No es parte de la respuesta normal de la API, solo se usa cuando hay errores)
  _error?: string;
}

/**
 * Obtiene datos de analíticas desde la API de Replit
 * @param timeRange Rango de tiempo para obtener datos ('7d', '30d', '90d')
 */
export async function fetchReplitAnalytics(timeRange: '7d' | '30d' | '90d'): Promise<ReplitAnalyticsData> {
  try {
    // Para acceder a la API de Replit Analytics, necesitamos el ID del Repl y un token
    // Estos valores se pueden obtener de las variables de entorno
    const replitToken = process.env.REPLIT_ANALYTICS_TOKEN;
    const replId = process.env.REPL_ID || process.env.REPLIT_ID;
    
    // Si no hay token o ID, lanzamos un error
    if (!replitToken || !replId) {
      throw new Error('No se encontraron las credenciales necesarias para acceder a Replit Analytics');
    }
    
    // Calculamos las fechas de inicio y fin según el rango seleccionado
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
    }
    
    // Formateamos fechas como YYYY-MM-DD para la API
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    
    // URL de la API de Replit Analytics - Usando la API v1
    // La API v1 es más estable y está mejor documentada
    const apiUrl = `https://replit.com/api/v1/data/replAnalytics?repl_id=${replId}&from=${start}&to=${end}`;
    
    console.log(`Intentando conectar a la API en: ${apiUrl}`);
    
    // Realizamos la petición a la API con el formato correcto de token
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Replit-Api-Key': replitToken,
        'User-Agent': 'QRCodeQuest-App/1.0',
      },
    });
    
    // Si hay error en la respuesta, lanzamos un error
    if (!response.ok) {
      throw new Error(`Error en la llamada a la API de Replit: ${response.status} ${response.statusText}`);
    }
    
    // Procesamos la respuesta para obtener los datos
    const rawData = await response.json();
    
    // Como no tenemos documentación exacta de la estructura de la respuesta,
    // esto es una aproximación que deberá adaptarse cuando se tenga acceso real
    // a la API de Replit Analytics
    
    // Ejemplo de procesamiento de datos
    // Nota: La estructura exacta debe ajustarse según la API real
    return processAnalyticsData(rawData, timeRange);
    
  } catch (error) {
    console.error('Error al obtener datos de Replit Analytics:', error);
    
    // En caso de error, devolvemos un objeto vacío con una estructura predecible
    // pero también incluimos información del error para que el cliente pueda manejarlo
    let errorMessage = 'Error desconocido';
    
    if (error instanceof Error) {
      // Agregamos información de contexto para ayudar a diagnosticar el problema
      errorMessage = error.message.includes('403') 
        ? 'Acceso denegado (403) - El token no tiene permisos suficientes o ha expirado'
        : error.message;
    }
    
    // Creamos una versión extendida del objeto ReplitAnalyticsData
    // con un campo adicional para el error
    const emptyData = {
      totalVisits: 0,
      totalUsers: 0,
      newUsers: 0,
      returningUsers: 0,
      visitsByDay: [],
      deviceData: [],
      browserData: [],
      countryData: [],
      _error: errorMessage  // Campo adicional que no es parte del tipo ReplitAnalyticsData
    };
    
    return emptyData;
  }
}

/**
 * Procesa los datos crudos de la API y los transforma al formato deseado
 */
function processAnalyticsData(rawData: any, timeRange: string): ReplitAnalyticsData {
  try {
    console.log('Procesando datos de la API Replit:', JSON.stringify(rawData, null, 2).substring(0, 500) + '...');
    
    // Adaptación para el formato de la API v1 de Replit
    // La estructura puede variar, por lo que añadimos comprobaciones para evitar errores
    
    // Inicializamos con datos vacíos
    const processedData: ReplitAnalyticsData = {
      totalVisits: 0,
      totalUsers: 0,
      newUsers: 0,
      returningUsers: 0,
      visitsByDay: [],
      deviceData: [],
      browserData: [],
      countryData: []
    };
    
    // Si tenemos datos en la respuesta
    if (rawData && typeof rawData === 'object') {
      // Procesamiento para API v1
      if (rawData.data) {
        // Extraer métricas totales
        processedData.totalVisits = rawData.data.totalViews || 0;
        processedData.totalUsers = rawData.data.uniqueUsers || 0;
        processedData.newUsers = rawData.data.newUsers || 0;
        processedData.returningUsers = processedData.totalUsers - processedData.newUsers;
        
        // Procesar datos por día
        if (Array.isArray(rawData.data.timeSeriesData)) {
          processedData.visitsByDay = rawData.data.timeSeriesData.map((day: any) => ({
            date: day.date || day.timestamp || 'Unknown',
            visits: day.views || 0,
            uniqueUsers: day.uniqueUsers || 0
          }));
        }
        
        // Procesar datos de dispositivos
        if (rawData.data.deviceData) {
          processedData.deviceData = Object.entries(rawData.data.deviceData)
            .map(([name, value]: [string, any]) => ({
              name: name === 'unknown' ? 'Desconocido' : name,
              value: typeof value === 'number' ? value : 0
            }));
        }
        
        // Procesar datos de navegadores
        if (rawData.data.browserData) {
          processedData.browserData = Object.entries(rawData.data.browserData)
            .map(([name, value]: [string, any]) => ({
              name: name === 'unknown' ? 'Desconocido' : name,
              value: typeof value === 'number' ? value : 0
            }));
        }
        
        // Procesar datos de países
        if (rawData.data.countryData) {
          processedData.countryData = Object.entries(rawData.data.countryData)
            .map(([name, value]: [string, any]) => ({
              name: name === 'unknown' ? 'Desconocido' : name,
              value: typeof value === 'number' ? value : 0
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
        }
      }
    }
    
    return processedData;
    
  } catch (error) {
    console.error('Error al procesar datos de Analytics:', error);
    
    // Si hay un error en el procesamiento, devolvemos un objeto vacío
    return {
      totalVisits: 0,
      totalUsers: 0,
      newUsers: 0,
      returningUsers: 0,
      visitsByDay: [],
      deviceData: [],
      browserData: [],
      countryData: []
    };
  }
}