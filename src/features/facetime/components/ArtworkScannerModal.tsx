import { Modal } from "../../../app/components/Modal";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  RefreshCw,
  RotateCcw,
  ScanFace,
  Video,
  X,
} from "lucide-react";
import { captureMediaFrame } from "../../../utils/canvas";
import type { FaceTimeIdentifyResult, HistoricalProfile } from "../types";

interface ArtworkScannerModalProps {
  open: boolean;
  onClose: () => void;
  onConfirmCall: (profile: HistoricalProfile, scannedDataUrl: string) => void;
}

export const ArtworkScannerModal: React.FC<ArtworkScannerModalProps> = ({
  open,
  onClose,
  onConfirmCall,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(
    null
  );
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<FaceTimeIdentifyResult | null>(
    null
  );
  const [scanError, setScanError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(
    async (mode: "environment" | "user") => {
      stopCamera();
      setCameraError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "Live camera requires localhost or HTTPS. You can still upload a photo below."
          );
        }
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: mode,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          // Desktop webcams may reject facingMode: environment; retry default camera
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraReady(true);
      } catch (err) {
        setCameraReady(false);
        setCameraError(
          err instanceof Error
            ? err.message
            : "Could not access camera. Upload a photo of a painting or statue instead."
        );
      }
    },
    [stopCamera]
  );

  useEffect(() => {
    if (!open) {
      stopCamera();
      setCapturedPreviewUrl(null);
      setScanResult(null);
      setScanError(null);
      return;
    }
    if (!capturedPreviewUrl) {
      void startCamera(facingMode);
    }
    return () => {
      stopCamera();
    };
  }, [open, facingMode, capturedPreviewUrl, startCamera, stopCamera]);

  const identifyImage = useCallback(
    async (dataUrl: string, mimeType: string) => {
      setIsScanning(true);
      setScanError(null);
      setScanResult(null);
      setCapturedPreviewUrl(dataUrl);
      stopCamera();

      try {
        const res = await fetch("/api/facetime/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: dataUrl,
            mimeType,
          }),
        });
        const data = (await res.json()) as FaceTimeIdentifyResult & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || "Could not identify the artwork.");
        }
        setScanResult(data);
      } catch (err) {
        setScanError(
          err instanceof Error
            ? err.message
            : "Failed to scan image. Please try again."
        );
      } finally {
        setIsScanning(false);
      }
    },
    [stopCamera]
  );

  const handleCaptureFrame = () => {
    const el = videoRef.current;
    if (!el || el.readyState < 2) return;
    const captured = captureMediaFrame(el, 1024, 0.85);
    if (!captured) return;
    const dataUrl = `data:image/jpeg;base64,${captured.base64}`;
    void identifyImage(dataUrl, "image/jpeg");
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setScanError("Please select an image file (JPG, PNG, or WebP).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        void identifyImage(reader.result, file.type || "image/jpeg");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRescan = () => {
    setCapturedPreviewUrl(null);
    setScanResult(null);
    setScanError(null);
  };


  return (
    <Modal open={open} onClose={onClose} label="Scan artwork">
      <div className="w-full max-w-2xl rounded-xl overflow-hidden bg-surface border border-white/15 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-300/30 flex items-center justify-center text-amber-300">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                Scan artwork
              </h2>
              <p className="text-xs text-slate-400">
                Frame the historical figure clearly or upload an artwork photo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
            className="w-11 h-11 shrink-0 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Viewfinder / Captured Preview */}
        <div className="relative bg-black aspect-[16/10] w-full overflow-hidden flex items-center justify-center">
          {capturedPreviewUrl ? (
            <img
              src={capturedPreviewUrl}
              alt="Scanned artwork"
              className="w-full h-full object-contain bg-black"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />
              {!cameraReady && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300 text-sm bg-black/70">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                  <span>Starting camera…</span>
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6 bg-black/80">
                  <Camera className="w-8 h-8 text-slate-400" />
                  <p className="text-sm text-slate-300 max-w-md">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-slate-950 font-semibold text-sm cursor-pointer"
                  >
                    <ImagePlus className="w-4 h-4" />
                    <span>Upload Artwork Photo</span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* Viewfinder Corner Brackets */}
          {!scanResult?.detected && (
            <div className="pointer-events-none absolute inset-6 sm:inset-10">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/75 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/75 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/75 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/75 rounded-br-xl" />
            </div>
          )}

          {/* Scanning Spinner Overlay */}
          {isScanning && (
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <p className="text-sm font-medium text-white">
                Identifying historical figure…
              </p>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-mono text-sky-200">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                gemini-4-hydrogen · Multimodal Vision
              </span>
            </div>
          )}
        </div>

        {/* Caller ID Confirmation / Controls Footer */}
        <div className="p-5 bg-[#0E131D] border-t border-white/10 space-y-4 overflow-y-auto">
          {scanError && (
            <div className="rounded-2xl bg-rose-500/15 border border-rose-400/30 px-4 py-3 text-sm text-rose-100 flex items-center justify-between gap-3">
              <span>{scanError}</span>
              <button
                type="button"
                onClick={handleRescan}
                className="text-xs font-semibold px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer shrink-0"
              >
                Try Again
              </button>
            </div>
          )}

          {scanResult && scanResult.detected && scanResult.profile ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-400/25 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Identified {scanResult.artworkType} ·{" "}
                      {Math.round(scanResult.confidence * 100)}% match
                    </span>
                    {scanResult.demoMode && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-200 text-[10px]">
                        Demo Fixture
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    {scanResult.profile.name}
                  </h3>
                  <p className="text-xs text-slate-300">
                    {scanResult.profile.title} · {scanResult.profile.era}
                  </p>
                  {scanResult.artworkTitle && (
                    <p className="text-xs text-slate-400">
                      Artwork: {scanResult.artworkTitle}
                      {scanResult.artist ? ` (${scanResult.artist})` : ""}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleRescan}
                    className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-sm font-medium cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Rescan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onConfirmCall(
                        scanResult.profile!,
                        capturedPreviewUrl || ""
                      )
                    }
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-accent-500 hover:bg-accent-400 text-slate-950 font-semibold text-sm  cursor-pointer"
                  >
                    <Video className="w-4 h-4" />
                    <span>Call {scanResult.profile.name.split(" ")[0]}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : scanResult && !scanResult.detected ? (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-400/25 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-200">
                  No historical figure recognized in that frame
                </p>
                <p className="text-xs text-slate-300">
                  {scanResult.reason ||
                    "Move closer so the painting, photo, or statue face fills the frame."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRescan}
                className="px-4 py-2 rounded-lg bg-white text-slate-950 text-sm font-semibold cursor-pointer shrink-0"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-slate-200 text-sm font-medium cursor-pointer disabled:opacity-50"
              >
                <ImagePlus className="w-4 h-4" />
                <span>Upload Photo</span>
              </button>

              <button
                type="button"
                onClick={handleCaptureFrame}
                disabled={!cameraReady || isScanning}
                className="inline-flex items-center gap-2.5 px-7 py-3 rounded-lg bg-accent-500 hover:bg-accent-400 disabled:bg-white/10 disabled:text-slate-500 text-slate-950 font-semibold text-sm  cursor-pointer disabled:cursor-not-allowed"
              >
                <Camera className="w-4 h-4" />
                <span>Scan Figure</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setFacingMode((m) =>
                    m === "environment" ? "user" : "environment"
                  )
                }
                disabled={isScanning || Boolean(capturedPreviewUrl)}
                aria-label="Flip scanner camera"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-slate-200 text-sm font-medium cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Flip</span>
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUploadFile}
            className="hidden"
          />
        </div>
      </div>
    </Modal>
  );
};
