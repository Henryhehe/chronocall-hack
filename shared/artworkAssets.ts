// Public-domain John Faed reproduction, 639 × 900 pixels (not an AI upscale).
// Keep the gallery, call previews, and homepage on the same source.
export const WASHINGTON_IMAGE_SOURCE =
  'https://upload.wikimedia.org/wikipedia/commons/7/77/Portrait-of-george-washington-taking-the-salute-at-trenton-john-faed.jpg';

// Same-origin delivery keeps the animated portrait canvas readable for camera/AI frames.
export const WASHINGTON_IMAGE_URL =
  `/api/facetime/artwork-proxy?url=${encodeURIComponent(WASHINGTON_IMAGE_SOURCE)}`;

export const WASHINGTON_IMAGE_FALLBACK = '/assets/aistudio/washington_fd94f6dd.jpeg';
