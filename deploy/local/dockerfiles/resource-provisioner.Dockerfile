FROM node:20-alpine
ENV NODE_ENV=production
ARG BUILD_SHA=dev
ARG BUILD_TIME=unknown
ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_TIME=$BUILD_TIME
WORKDIR /app/adapters/resource-provisioner
COPY adapters/resource-provisioner/package*.json ./
COPY adapters/resource-provisioner/src ./src
EXPOSE 18893
CMD ["node", "src/server.mjs"]
