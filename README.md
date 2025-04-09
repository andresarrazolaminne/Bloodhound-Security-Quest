
# Mapa de Logros - Instrucciones de Uso

## Para Usuarios

### Inicio de Sesión
1. Accede a la aplicación e ingresa tu número de documento
2. Si es tu primera vez, serás redirigido al registro
3. Una vez registrado, accederás al mapa de logros

### Navegación del Mapa
1. En la pantalla principal verás el mapa dividido en 9 segmentos
2. Los segmentos bloqueados aparecerán en gris
3. Los segmentos desbloqueados mostrarán su imagen correspondiente

### Desbloquear Segmentos
1. Pulsa el botón naranja con ícono QR en la esquina inferior derecha
2. Escanea el código QR del segmento que deseas desbloquear
3. Al desbloquear un segmento, verás una animación de éxito

### Reclamar Premio
1. Cuando desbloquees todos los segmentos, recibirás automáticamente un código de premio
2. El código se mostrará en formato QR y texto
3. Guarda o imprime el código para reclamarlo posteriormente

## Para Administradores

### Acceso al Panel
1. Navega a la ruta `/admin-login`
2. Ingresa las credenciales de administrador

### Gestión de Segmentos
1. En el panel de administración, ve a la pestaña "Segmentos del Mapa"
2. Puedes:
   - Crear nuevos segmentos
   - Editar segmentos existentes
   - Eliminar segmentos
   - Cargar ejemplos predeterminados

### Validación de Premios
1. En el panel de administración, ve a la pestaña "Validación de Premios"
2. Ingresa el código de premio del usuario
3. Verifica si el premio es válido y no ha sido reclamado anteriormente

### Generador de QR
1. Accede a la ruta `/qr-generator`
2. Selecciona el ID del segmento (1-9)
3. Genera el código QR individual o todos los códigos a la vez

## Notas Importantes
- Cada segmento tiene un código de seguridad único
- Los premios solo pueden ser reclamados una vez
- El progreso del usuario se guarda automáticamente
- Se mantiene la última sesión iniciada para facilitar el acceso

## Rutas Principales
- `/` - Inicio de sesión
- `/map` - Mapa de logros
- `/admin-login` - Acceso administrador
- `/admin` - Panel de administración
- `/qr-generator` - Generador de códigos QR
