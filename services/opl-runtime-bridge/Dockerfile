FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV PORT=8080
ENV PORTAL_RUNTIME_BRIDGE_STATE_ROOT=/tmp/medopl-runtime/.runtime
WORKDIR /app
COPY package.json ./
COPY src ./src
RUN mkdir -p /tmp/medopl-runtime/.runtime \
  && chown -R node:node /tmp/medopl-runtime
EXPOSE 8080

USER node
CMD ["npm", "start"]
