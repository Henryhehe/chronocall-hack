import {createRoot} from 'react-dom/client';
import App from './app/App.tsx';
import './index.css';
import MuseumApp from './features/museum/MuseumApp';
import FaceTimeApp from './features/facetime/FaceTimeApp';
import { RuntimeStatus } from './app/RuntimeStatus';

const pathname = window.location.pathname;

const rootView = pathname.startsWith("/museum") ? (
  <div className="museum-workspace">
    <div className="flex items-center gap-4 bg-slate-950 text-white px-4 py-2 text-sm">
      <a href="/" className="text-emerald-300 hover:text-emerald-200">← FaceTime</a>
      <a href="/workspaces" className="text-slate-300 hover:text-white">Lab Workspaces</a>
    </div>
    <RuntimeStatus />
    <MuseumApp />
  </div>
) : pathname.startsWith("/workspaces") ? (
  <App />
) : (
  <FaceTimeApp />
);

createRoot(document.getElementById('root')!).render(rootView);
