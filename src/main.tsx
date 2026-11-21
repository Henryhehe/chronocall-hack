import {createRoot} from 'react-dom/client';
import App from './app/App.tsx';
import FaceTimeApp from './features/facetime/FaceTimeApp';
import './index.css';

createRoot(document.getElementById('root')!).render(
  window.location.pathname.startsWith('/facetime') ? <FaceTimeApp /> : <App />
);
