FROM node:22-alpine

WORKDIR /app
ENV BILLING_REPO_ROOT=/app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

CMD ["node", "src/server.mjs"]
