import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Initialize CSS custom properties with system config ONLY
const initializeStyles = async () => {
  let config = {};
  
  // Fetch system config and use ONLY database values
  try {
    const response = await fetch('/api/system-config?t=' + Date.now());
    if (response.ok) {
      const data = await response.json();
      config = data.config || {};
    } else {
      console.error('Failed to load system config - response not ok');
      return;
    }
  } catch (error) {
    console.error('Failed to load system config:', error);
    return;
  }

  // Apply styles to document using ONLY database values - no fallbacks
  const timestamp = Date.now();
  document.documentElement.style.setProperty('--background-image-url', config.backgroundImageUrl ? `url('${config.backgroundImageUrl}?t=${timestamp}')` : '');
  document.documentElement.style.setProperty('--background-size', config.backgroundSize || 'auto');
  document.documentElement.style.setProperty('--background-repeat', config.backgroundRepeat || 'repeat');
  document.documentElement.style.setProperty('--background-position', config.backgroundPosition || 'center');
  document.documentElement.style.setProperty('--gradient-start-color', config.gradientStartColor || '');
  document.documentElement.style.setProperty('--gradient-mid-color', config.gradientMidColor || '');
  document.documentElement.style.setProperty('--gradient-end-color', config.gradientEndColor || '');
  document.documentElement.style.setProperty('--gradient-direction', config.gradientDirection || '175deg');
  document.documentElement.style.setProperty('--gradient-type', config.gradientType || 'linear');
};

// Initialize styles before rendering
initializeStyles().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
}).catch((error) => {
  console.error('Error initializing styles:', error);
  // Fallback: render anyway
  createRoot(document.getElementById("root")!).render(<App />);
});
