import { useCallback, useEffect, useRef, useState } from "react";
import type { SourceMode } from "../../types/vision";

interface MediaOptions {
  onError: (message: string | null) => void;
  onStarted: () => void;
  onStopped: () => void;
  onImageReady: () => void;
}

/** Owns camera tracks and uploaded URLs for the lifetime of the app workspace. */
export function useMediaSource(options: MediaOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [sourceMode, setSourceMode] = useState<SourceMode>("camera");
  const [mediaActive, setMediaActive] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const selectedRef = useRef(selectedCameraId);
  selectedRef.current = selectedCameraId;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const uploadRef = useRef<string | null>(null);
  const requestId = useRef(0);

  const stop = useCallback(() => {
    requestId.current++;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
    if (uploadRef.current) URL.revokeObjectURL(uploadRef.current);
    uploadRef.current = null;
    setUploadedImageUrl(null);
    setUploadedVideoUrl(null);
    setMediaActive(false);
    optionsRef.current.onStopped();
  }, []);

  const refreshCameras = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput");
      setCameras(inputs);
      setSelectedCameraId((current) => current || inputs[0]?.deviceId || "");
    } catch { /* Device labels may be unavailable before permission. */ }
  }, []);

  const startStream = useCallback(async (mode: "camera" | "screen", deviceId?: string) => {
    stop();
    const id = requestId.current;
    optionsRef.current.onError(null);
    try {
      if (!navigator.mediaDevices) throw new Error("Camera access requires localhost or HTTPS.");
      const target = deviceId ?? selectedRef.current;
      const stream = mode === "screen"
        ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        : await navigator.mediaDevices.getUserMedia({ video: { ...(target ? { deviceId: { exact: target } } : { facingMode: "environment" }), width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (requestId.current !== id) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      track.onended = () => { if (streamRef.current === stream) stop(); };
      if (mode === "camera" && track.getSettings().deviceId) setSelectedCameraId(track.getSettings().deviceId!);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (requestId.current !== id) return;
      setSourceMode(mode);
      setMediaActive(true);
      optionsRef.current.onStarted();
      void refreshCameras();
    } catch (err) {
      if (requestId.current !== id) return;
      stop();
      optionsRef.current.onError(err instanceof Error ? err.message : "Unable to start media.");
    }
  }, [refreshCameras, stop]);

  const startCamera = useCallback((deviceId?: string) => startStream("camera", deviceId), [startStream]);
  const startScreenShare = useCallback(() => startStream("screen"), [startStream]);
  const upload = useCallback((file: File) => {
    stop();
    optionsRef.current.onError(null);
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      optionsRef.current.onError("Choose an image or video file.");
      return;
    }
    const url = URL.createObjectURL(file);
    uploadRef.current = url;
    setSourceMode("image");
    if (file.type.startsWith("video/")) {
      setUploadedVideoUrl(url);
      setMediaActive(true);
      optionsRef.current.onStarted();
    } else setUploadedImageUrl(url);
  }, [stop]);

  useEffect(() => {
    if (!uploadedVideoUrl || !videoRef.current) return;
    videoRef.current.src = uploadedVideoUrl;
    void videoRef.current.play().catch(() => {});
  }, [uploadedVideoUrl]);

  useEffect(() => {
    const image = imageRef.current;
    if (!uploadedImageUrl || !image) return;
    const ready = () => optionsRef.current.onImageReady();
    if (image.complete && image.naturalWidth) ready();
    else image.addEventListener("load", ready, { once: true });
    return () => image.removeEventListener("load", ready);
  }, [uploadedImageUrl]);

  useEffect(() => {
    void refreshCameras();
    navigator.mediaDevices?.addEventListener("devicechange", refreshCameras);
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", refreshCameras);
      stop();
    };
  }, [refreshCameras, stop]);

  const getActiveMediaElement = useCallback(() => {
    if ((streamRef.current || uploadRef.current) && videoRef.current && videoRef.current.readyState >= 2) return videoRef.current;
    if (uploadRef.current && imageRef.current?.complete && imageRef.current.naturalWidth) return imageRef.current;
    return null;
  }, []);

  return { sourceMode, mediaActive, uploadedImageUrl, uploadedVideoUrl, cameras, selectedCameraId, setSelectedCameraId, videoRef, imageRef, startCamera, startScreenShare, upload, stop, getActiveMediaElement };
}
