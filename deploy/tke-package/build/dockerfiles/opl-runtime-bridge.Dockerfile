FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app/services/opl-runtime-bridge
COPY source/services/opl-runtime-bridge/package*.json ./
COPY source/services/opl-runtime-bridge/src ./src
WORKDIR /app
COPY source/.runtime/one-person-lab-upstream ./.runtime/one-person-lab-upstream
WORKDIR /app/services/opl-runtime-bridge
EXPOSE 8788
CMD ["node", "src/server.mjs"]
