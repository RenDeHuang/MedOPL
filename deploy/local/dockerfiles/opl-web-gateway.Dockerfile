FROM node:20-alpine
ENV NODE_ENV=production
ARG BUILD_SHA=dev
ARG BUILD_TIME=unknown
ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_TIME=$BUILD_TIME
WORKDIR /app/services/opl-web-gateway
COPY services/opl-web-gateway/src ./src
EXPOSE 13031
CMD ["node", "src/server.mjs"]
