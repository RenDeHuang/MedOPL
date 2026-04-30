FROM node:20-alpine AS frontend
WORKDIR /app/services/portal/frontend
COPY services/portal/frontend/package*.json ./
RUN npm ci
COPY services/portal/frontend ./
RUN npm run build

FROM node:20-alpine
ENV NODE_ENV=production
ARG BUILD_SHA=dev
ARG BUILD_TIME=unknown
ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_TIME=$BUILD_TIME
WORKDIR /app/services/portal
COPY services/portal/package*.json ./
RUN npm ci --omit=dev
COPY services/portal/src ./src
WORKDIR /app
COPY scripts ./scripts
COPY --from=frontend /app/services/portal/frontend/dist ./services/portal/frontend/dist
WORKDIR /app/services/portal
EXPOSE 17080
CMD ["node", "src/server.mjs"]
