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
          setDetectedUrl(origin);
        } else {
          const resolved =
            typeof data?.appUrl === 'string' && data.appUrl.startsWith('http')
              ? data.appUrl
              : origin;
          setDetectedUrl(resolved);
        }
      })
      .catch(() => {
        if (active) setDetectedUrl(window.location.origin);
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

  if (!open) return null;

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#FBF9F4] border border-[#181614]/15 p-6 shadow-2xl text-[#181614]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#6B655E]">
              Smartphone Browser Launcher
            </p>
            <h3 id="mobile-preview-title" className="font-serif text-2xl font-semibold mt-1">
              Open on Mobile Phone
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close mobile preview modal"
            className="min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center text-[#57514A] hover:bg-[#EBE6DC] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isProxyUrl ? (
          <p className="text-xs text-[#7C2D12] bg-[#9A3412]/10 border border-[#9A3412]/20 rounded-lg p-3 mt-3 leading-relaxed">
            Direct <code className="font-mono">ais-pre-</code> / <code className="font-mono">ais-dev-</code> URLs are AI Studio iframe proxies that enforce cross-site cookie checks and often return 403 on mobile browsers. To open directly on a phone, use your <strong>Deploy App</strong> Cloud Run URL or the <strong>AI Studio Share link</strong> (<code className="font-mono">aistudio.google.com/...</code>) below.
          </p>
        ) : (
          <p className="text-sm text-[#57514A] mt-2 leading-relaxed">
            Scan this QR code with your smartphone camera or copy the link below to use the rear camera and live microphone directly in your mobile browser.
          </p>
        )}

        <div className="my-4 flex items-center justify-center">
          {qrDataUrl ? (
            <div className="p-3 rounded-xl bg-[#FBF9F4] border border-[#181614]/12">
              <img
                src={qrDataUrl}
                alt="QR code to open Tableau Vivant on a mobile phone"
                className="w-44 h-44 block"
              />
            </div>
          ) : (
            <div className="w-48 h-48 rounded-xl bg-[#EBE6DC] flex items-center justify-center text-xs text-[#6B655E]">
              Generating QR code...
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          <label className="block text-xs font-medium text-[#57514A]">
            Paste Deployed Cloud Run URL or AI Studio Share Link
            <input
              type="url"
              value={customUrl}
              onChange={(e) => handleCustomUrlChange(e.target.value)}
              placeholder="https://your-deployed-service.run.app"
              className="mt-1 w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#F0ECE2] border border-[#181614]/15 text-xs font-mono text-[#181614] placeholder:text-[#8A8277] focus:outline-none focus:border-[#8C6229]"
            />
          </label>

          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-[#F0ECE2] border border-[#181614]/12 text-xs font-mono text-[#181614] truncate select-all">
              {activeUrl || 'Loading preview URL...'}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!activeUrl}
              className="min-h-[42px] px-3.5 py-2 rounded-lg bg-[#181614] text-[#FBF9F4] text-xs font-medium hover:bg-[#2E2A26] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Link'}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#181614]/10 flex items-center gap-2 text-xs text-[#6B655E]">
          <Smartphone className="w-4 h-4 text-[#8C6229] shrink-0" />
          <span>Tip: Open in standard Safari or Chrome on your phone for camera and mic access.</span>
        </div>
      </div>
    </div>
  );
};
