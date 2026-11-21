import { Modal } from "../../../app/components/Modal";
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Smartphone, X } from 'lucide-react';

interface MobilePreviewModalProps {
  open: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'tableau_vivant_mobile_url';

export const MobilePreviewModal: React.FC<MobilePreviewModalProps> = ({ open, onClose }) => {
  const [detectedUrl, setDetectedUrl] = useState<string>('');
  const [customUrl, setCustomUrl] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/app-url')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const origin = window.location.origin;
        const isDeployedOrigin =
          origin.startsWith('https://') &&
          !origin.includes('ais-dev-') &&
          !origin.includes('ais-pre-');

        if (isDeployedOrigin) {
          setDetectedUrl(origin + "/museum");
        } else {
          const resolved =
            typeof data?.appUrl === 'string' && data.appUrl.startsWith('http')
              ? data.appUrl
              : origin + "/museum";
          setDetectedUrl(resolved);
        }
      })
      .catch(() => {
        if (active) setDetectedUrl(window.location.origin + "/museum");
      });
    return () => {
      active = false;
    };
  }, []);

  const activeUrl = (customUrl.trim() || detectedUrl).trim();
  const isProxyUrl =
    activeUrl.includes('ais-dev-') || activeUrl.includes('ais-pre-');

  useEffect(() => {
    if (!activeUrl) return;
    QRCode.toDataURL(activeUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#181614',
        light: '#FBF9F4',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => {});
  }, [activeUrl]);


  const handleCustomUrlChange = (value: string) => {
    setCustomUrl(value);
    try {
      if (value.trim()) {
        localStorage.setItem(STORAGE_KEY, value.trim());
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  };

  const handleCopy = async () => {
    if (!activeUrl) return;
    try {
      await navigator.clipboard.writeText(activeUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <Modal open={open} onClose={onClose} label="Open on phone">
      <div
        className="w-full max-w-md rounded-2xl bg-surface border border-white/15 p-6 shadow-2xl text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">
              CONTINUE EXPLORING
            </p>
            <h3 id="mobile-preview-title" className="font-serif text-2xl font-semibold mt-1">
              Open on phone
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close mobile preview modal"
            className="min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center text-slate-300 hover:bg-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isProxyUrl ? (
          <p className="text-xs text-rose-200 bg-[#9A3412]/10 border border-[#9A3412]/20 rounded-lg p-3 mt-3 leading-relaxed">
            Direct <code className="font-mono">ais-pre-</code> / <code className="font-mono">ais-dev-</code> URLs are AI Studio iframe proxies that enforce cross-site cookie checks and often return 403 on mobile browsers. To open directly on a phone, use your <strong>Deploy App</strong> Cloud Run URL or the <strong>AI Studio Share link</strong> (<code className="font-mono">aistudio.google.com/...</code>) below.
          </p>
        ) : (
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Scan this QR code with your smartphone camera or copy the link below to use the rear camera and live microphone directly in your mobile browser.
          </p>
        )}

        <div className="my-4 flex items-center justify-center">
          {qrDataUrl ? (
            <div className="p-3 rounded-xl bg-surface border border-white/12">
              <img
                src={qrDataUrl}
                alt="QR code to open Chronocall on a phone"
                className="w-44 h-44 block"
              />
            </div>
          ) : (
            <div className="w-48 h-48 rounded-xl bg-elevated flex items-center justify-center text-xs text-slate-400">
              Generating QR code...
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          <label className="block text-xs font-medium text-slate-300">
            Public app link (optional)
            <input
              type="url"
              value={customUrl}
              onChange={(e) => handleCustomUrlChange(e.target.value)}
              placeholder="https://your-deployed-service.run.app"
              className="mt-1 w-full min-h-[40px] px-3 py-2 rounded-lg bg-elevated border border-white/15 text-xs font-mono text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-accent-500"
            />
          </label>

          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-elevated border border-white/12 text-xs font-mono text-slate-100 truncate select-all">
              {activeUrl || 'Loading preview URL...'}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!activeUrl}
              className="min-h-[42px] px-3.5 py-2 rounded-lg bg-elevated text-[#FBF9F4] text-xs font-medium hover:bg-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy link'}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-slate-400">
          <Smartphone className="w-4 h-4 text-accent-400 shrink-0" />
          <span>Tip: Open in standard Safari or Chrome on your phone for camera and mic access.</span>
        </div>
      </div>
    </Modal>
  );
};
