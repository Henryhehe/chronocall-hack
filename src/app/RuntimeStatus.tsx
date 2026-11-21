import { useEffect, useState } from "react";

export function RuntimeStatus() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/health", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Backend unavailable");
        const status = await response.json();
        setMessage(status.demoMode
          ? "Local demo mode: AI responses use sample data. Live voice and Genie streaming require a Gemini connection."
          : !status.apiKeyConfigured ? "AI features are not configured on this server. Camera previews and the preset 3D world are available." : null);
      })
      .catch(() => { if (!controller.signal.aborted) setMessage("Cannot reach the backend. Start the full Chronocall server and reload this page."); });
    return () => controller.abort();
  }, []);
  if (!message) return null;
  return <div role="status" className="border-b border-amber-800/50 bg-amber-950/30 px-6 py-2 text-sm text-amber-200">{message}</div>;
}
