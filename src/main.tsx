import {createRoot} from 'react-dom/client';
import App from './app/App.tsx';
import './index.css';
import MuseumApp from './features/museum/MuseumApp';
import { RuntimeStatus } from './app/RuntimeStatus';

createRoot(document.getElementById('root')!).render(window.location.pathname.startsWith("/museum") ? <div className="museum-workspace"><a href="/" className="block bg-slate-950 text-white px-4 py-2">← Chronocall workspaces</a><RuntimeStatus /><MuseumApp /></div> : <App />);
