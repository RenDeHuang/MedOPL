FROM node:20-alpine
ENV NODE_ENV=production
ARG BUILD_SHA=dev
ARG BUILD_TIME=unknown
ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_TIME=$BUILD_TIME
WORKDIR /app/adapters/resource-provisioner
COPY source/adapters/resource-provisioner/package*.json ./
RUN npm install --omit=dev
COPY source/adapters/resource-provisioner ./
WORKDIR /app/adapters/resource-provisioner
EXPOSE 18893
CMD ["node", "src/server.mjs"]
