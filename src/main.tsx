import { createRoot } from 'react-dom/client';
import App from './App';
import { LangProvider } from './i18n';
import './styles/global.css';
import './styles/layout.css';
import './styles/animations.css';

// StrictMode is intentionally not used: it double-mounts effects in development, which would create
// two WebGL contexts on the same canvas.
createRoot(document.getElementById('root')!).render(<LangProvider><App /></LangProvider>);
