FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app/services/opl-web-gateway
COPY source/services/opl-web-gateway/src ./src
EXPOSE 13031
CMD ["node", "src/server.mjs"]
