FROM node:20-alpine AS frontend
WORKDIR /app/services/portal/frontend
COPY source/services/portal/frontend/package*.json ./
RUN npm ci
COPY source/services/portal/frontend ./
RUN npm run build

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app/services/portal
COPY source/services/portal/package*.json ./
RUN npm ci --omit=dev
COPY source/services/portal/src ./src
COPY --from=frontend /app/services/portal/frontend/dist ./frontend/dist
WORKDIR /app
COPY source/scripts ./scripts
WORKDIR /app/services/portal
EXPOSE 17080
CMD ["node", "src/server.mjs"]
