# Bun installs the checked-in lockfile; Node runs both Vite and the API server.
FROM oven/bun:1.3.3 AS bun
FROM node:24-bookworm-slim AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock bunfig.toml .npmrc ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
# Keep tsx (currently a devDependency): it is required by the startup command.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/shared ./shared
COPY --from=build --chown=node:node /app/src/features/museum/data ./src/features/museum/data
COPY --from=build --chown=node:node /app/package.json /app/tsconfig.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health', {signal: AbortSignal.timeout(4000)}).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "--import", "tsx", "server/index.ts", "--production"]
