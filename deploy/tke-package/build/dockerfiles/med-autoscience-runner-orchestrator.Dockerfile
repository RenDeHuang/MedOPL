FROM kindest/node:v1.27.3 AS kubectl

FROM node:20-alpine
ENV NODE_ENV=production
COPY --from=kubectl /usr/bin/kubectl /usr/local/bin/kubectl
WORKDIR /tmp/portal-deps
COPY source/services/portal/package*.json ./
RUN npm ci --omit=dev && mkdir -p /app && cp -R node_modules /app/node_modules
WORKDIR /app
COPY source/adapters/shared ./adapters/shared
COPY source/adapters/med-autoscience-runner ./adapters/med-autoscience-runner
COPY source/infra/kubernetes ./infra/kubernetes
COPY source/scripts ./scripts
WORKDIR /app/adapters/med-autoscience-runner
EXPOSE 18890
CMD ["node", "src/server.mjs"]
