import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Initialize CSS custom properties with default values
const initializeStyles = () => {
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

  document.documentElement.style.setProperty('--background-image-url', `url('${defaultConfig.backgroundImageUrl}')`);
  document.documentElement.style.setProperty('--background-size', defaultConfig.backgroundSize);
  document.documentElement.style.setProperty('--background-repeat', defaultConfig.backgroundRepeat);
  document.documentElement.style.setProperty('--background-position', defaultConfig.backgroundPosition);
  document.documentElement.style.setProperty('--gradient-start-color', defaultConfig.gradientStartColor);
  document.documentElement.style.setProperty('--gradient-mid-color', defaultConfig.gradientMidColor);
  document.documentElement.style.setProperty('--gradient-end-color', defaultConfig.gradientEndColor);
  document.documentElement.style.setProperty('--gradient-direction', defaultConfig.gradientDirection);
  document.documentElement.style.setProperty('--gradient-type', defaultConfig.gradientType);
};

// Initialize styles before rendering
initializeStyles();

createRoot(document.getElementById("root")!).render(<App />);
