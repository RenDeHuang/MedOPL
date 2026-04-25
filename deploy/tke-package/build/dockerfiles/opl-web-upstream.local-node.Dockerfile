FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_OPL_DEFAULT_LANGUAGE=zh-CN
ENV VITE_OPL_DEFAULT_LANGUAGE=${VITE_OPL_DEFAULT_LANGUAGE}
RUN npm install -g bun
COPY package.json bun.lock ./
COPY patches/ ./patches/
RUN bun install --ignore-scripts
COPY . .
RUN bun run build:renderer:web
RUN node scripts/build-server.mjs

FROM node:20-alpine AS runtime
WORKDIR /app
RUN npm install -g bun
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/out/renderer ./out/renderer
COPY package.json bun.lock ./
COPY patches/ ./patches/
RUN bun install --production --ignore-scripts
ENV PORT=3000
ENV NODE_ENV=production
ENV ALLOW_REMOTE=true
ENV DATA_DIR=/data
ENV VITE_OPL_DEFAULT_LANGUAGE=zh-CN
VOLUME ["/data"]
EXPOSE 3000
CMD ["bun", "dist-server/server.mjs"]

