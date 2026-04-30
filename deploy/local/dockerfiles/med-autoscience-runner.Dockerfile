FROM kindest/node:v1.27.3 AS kubectl

FROM node:20-alpine
ENV NODE_ENV=production
ARG BUILD_SHA=dev
ARG BUILD_TIME=unknown
ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_TIME=$BUILD_TIME
COPY --from=kubectl /usr/bin/kubectl /usr/local/bin/kubectl
WORKDIR /app
COPY adapters/shared ./adapters/shared
COPY adapters/med-autoscience-runner ./adapters/med-autoscience-runner
COPY infra/kubernetes ./infra/kubernetes
COPY scripts ./scripts
WORKDIR /app/adapters/med-autoscience-runner
EXPOSE 18890
CMD ["node", "src/server.mjs"]
