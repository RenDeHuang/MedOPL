FROM node:24-bookworm-slim
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g @openai/codex@0.128.0
ARG BUILD_SHA=dev
ARG BUILD_TIME=unknown
ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_TIME=$BUILD_TIME
ENV OPL_CODEX_BIN=/usr/local/bin/codex
WORKDIR /app/services/opl-runtime-bridge
COPY source/services/opl-runtime-bridge/package*.json ./
COPY source/services/opl-runtime-bridge/src ./src
WORKDIR /app
COPY source/.runtime/one-person-lab-upstream /app/one-person-lab-upstream
WORKDIR /app/services/opl-runtime-bridge
EXPOSE 8788
CMD ["node", "src/server.mjs"]
