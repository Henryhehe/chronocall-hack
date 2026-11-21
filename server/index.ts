import http from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import express from "express";
import { createApp } from "./app.ts";
import { getServerConfig, loadEnvironment, projectRoot } from "./config.ts";
import { attachLiveBridge } from "./live/bridge.ts";

async function startServer() {
  loadEnvironment();
  if (process.argv.includes("--production")) process.env.NODE_ENV = "production";
  const config = getServerConfig();
  const services = config.demoMode
    ? (await import("./services/demo.ts")).demoServices
    : (await import("./services/gemini/index.ts")).geminiServices;
  const app = createApp({ services, ...config });
  const server = http.createServer(app);
  const live = attachLiveBridge(server, config.demoMode);
  let closeVite: (() => Promise<void>) | undefined;

  if (!config.production) {
    const { createServer } = await import("vite");
    const vite = await createServer({ root: projectRoot, server: { middlewareMode: true, hmr: process.env.DISABLE_HMR === "true" ? false : { server } }, appType: "spa" });
    app.use(vite.middlewares);
    closeVite = () => vite.close();
  } else {
    const dist = path.join(projectRoot, "dist");
    if (!existsSync(path.join(dist, "index.html"))) throw new Error("Missing production build. Run bun run build first.");
    app.use(express.static(dist));
    app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  server.on("error", (err: NodeJS.ErrnoException) => {
    console.error(err.code === "EADDRINUSE" ? `Port ${config.port} is in use. Set PORT in .env.local.` : err.message);
    process.exit(1);
  });
  server.listen(config.port, config.host, () => {
    console.log(`Chronocall: http://localhost:${config.port}${config.demoMode ? " (local demo mode)" : ""}`);
    if (!config.apiKeyConfigured && !config.demoMode) console.warn("GEMINI_API_KEY is missing. Set .env.local or run bun run dev:demo.");
  });

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    for (const socket of live.clients) socket.close(1001, "Server shutting down");
    live.close();
    await closeVite?.();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
