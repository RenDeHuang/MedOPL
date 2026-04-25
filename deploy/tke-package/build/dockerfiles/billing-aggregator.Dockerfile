FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /tmp/portal-deps
COPY source/services/portal/package*.json ./
RUN npm ci --omit=dev && mkdir -p /app && cp -R node_modules /app/node_modules
WORKDIR /app
COPY source/adapters/billing-aggregator ./adapters/billing-aggregator
WORKDIR /app/adapters/billing-aggregator
EXPOSE 3001
CMD ["node", "src/server.mjs"]
