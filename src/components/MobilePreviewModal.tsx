import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Smartphone, X } from 'lucide-react';

interface MobilePreviewModalProps {
  open: boolean;
  onClose: () => void;
}

export const MobilePreviewModal: React.FC<MobilePreviewModalProps> = ({ open, onClose }) => {
  const [mobileUrl, setMobileUrl] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/app-url')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const resolved =
          typeof data?.appUrl === 'string' && data.appUrl.startsWith('http')
            ? data.appUrl
            : window.location.origin;
        setMobileUrl(resolved);
      })
      .catch(() => {
        if (active) setMobileUrl(window.location.origin);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!mobileUrl) return;
    QRCode.toDataURL(mobileUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#181614',
        light: '#FBF9F4',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => {});
  }, [mobileUrl]);

  if (!open) return null;

  const handleCopy = async () => {
    if (!mobileUrl) return;
    try {
      await navigator.clipboard.writeText(mobileUrl);
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
              Smartphone Browser Preview
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

        <p className="text-sm text-[#57514A] mt-2 leading-relaxed">
          Scan this QR code with your smartphone camera or copy the HTTPS preview link below to use the rear camera and live microphone directly in your mobile browser.
        </p>

        <div className="my-5 flex items-center justify-center">
          {qrDataUrl ? (
            <div className="p-3 rounded-xl bg-[#FBF9F4] border border-[#181614]/12">
              <img
                src={qrDataUrl}
                alt="QR code to open Tableau Vivant on a mobile phone"
                className="w-48 h-48 block"
              />
            </div>
          ) : (
            <div className="w-54 h-54 rounded-xl bg-[#EBE6DC] flex items-center justify-center text-xs text-[#6B655E]">
              Generating QR code...
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-[#F0ECE2] border border-[#181614]/12 text-xs font-mono text-[#181614] truncate select-all">
            {mobileUrl || 'Loading preview URL...'}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!mobileUrl}
            className="min-h-[42px] px-3.5 py-2 rounded-lg bg-[#181614] text-[#FBF9F4] text-xs font-medium hover:bg-[#2E2A26] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Link'}</span>
          </button>
        </div>

        <div className="mt-4 pt-3 border-t border-[#181614]/10 flex items-center gap-2 text-xs text-[#6B655E]">
          <Smartphone className="w-4 h-4 text-[#8C6229] shrink-0" />
          <span>Tip: Point your phone at the Washington portrait to lock the AR anchor.</span>
        </div>
      </div>
    </div>
  );
};
