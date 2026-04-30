FROM node:20-alpine
ENV NODE_ENV=production
ARG BUILD_SHA=dev
ARG BUILD_TIME=unknown
ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_TIME=$BUILD_TIME
WORKDIR /app/services/opl-runtime-bridge
COPY services/opl-runtime-bridge/package*.json ./
COPY services/opl-runtime-bridge/src ./src
WORKDIR /app
COPY scripts ./scripts
WORKDIR /app/services/opl-runtime-bridge
EXPOSE 8788
CMD ["node", "src/server.mjs"]
