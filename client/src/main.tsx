import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Initialize CSS custom properties with system config or defaults
const initializeStyles = async () => {
  // Default fallback values
  const defaultConfig = {
    backgroundImageUrl: 'https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Textura-fondo-pagina.png',
    backgroundSize: 'auto',
    backgroundRepeat: 'repeat',
    backgroundPosition: 'center',
    gradientStartColor: '#bb2558',
    gradientMidColor: '',
    gradientEndColor: '#e8cf00',
    gradientDirection: '175deg',
    gradientType: 'linear'
  };

  let config = defaultConfig;
  
  // Try to fetch system config synchronously
  try {
    const response = await fetch('/api/system-config?t=' + Date.now());
    if (response.ok) {
      const data = await response.json();
      const systemConfig = data.config || {};
      
      // Merge with defaults
      config = {
        backgroundImageUrl: systemConfig.backgroundImageUrl || defaultConfig.backgroundImageUrl,
        backgroundSize: systemConfig.backgroundSize || defaultConfig.backgroundSize,
        backgroundRepeat: systemConfig.backgroundRepeat || defaultConfig.backgroundRepeat,
        backgroundPosition: systemConfig.backgroundPosition || defaultConfig.backgroundPosition,
        gradientStartColor: systemConfig.gradientStartColor || defaultConfig.gradientStartColor,
        gradientMidColor: systemConfig.gradientMidColor || defaultConfig.gradientMidColor,
        gradientEndColor: systemConfig.gradientEndColor || defaultConfig.gradientEndColor,
        gradientDirection: systemConfig.gradientDirection || defaultConfig.gradientDirection,
        gradientType: systemConfig.gradientType || defaultConfig.gradientType
      };
    }
  } catch (error) {
    console.warn('Failed to load system config, using defaults:', error);
  }

  // Apply styles to document
  const timestamp = Date.now();
  document.documentElement.style.setProperty('--background-image-url', config.backgroundImageUrl ? `url('${config.backgroundImageUrl}?t=${timestamp}')` : '');
  document.documentElement.style.setProperty('--background-size', config.backgroundSize);
  document.documentElement.style.setProperty('--background-repeat', config.backgroundRepeat);
  document.documentElement.style.setProperty('--background-position', config.backgroundPosition);
  document.documentElement.style.setProperty('--gradient-start-color', config.gradientStartColor);
  document.documentElement.style.setProperty('--gradient-mid-color', config.gradientMidColor);
  document.documentElement.style.setProperty('--gradient-end-color', config.gradientEndColor);
  document.documentElement.style.setProperty('--gradient-direction', config.gradientDirection);
  document.documentElement.style.setProperty('--gradient-type', config.gradientType);
};

// Initialize styles before rendering
initializeStyles().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
}).catch((error) => {
  console.error('Error initializing styles:', error);
  // Fallback: render anyway
  createRoot(document.getElementById("root")!).render(<App />);
});
