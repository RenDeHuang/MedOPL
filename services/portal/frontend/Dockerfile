FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html postcss.config.mjs tsconfig.app.json tsconfig.json tsconfig.node.json vite.config.ts ./
COPY src ./src
RUN npm run build

FROM nginx:1.27-bookworm

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
RUN mkdir -p /tmp/nginx \
  && chown -R nginx:nginx /tmp/nginx /var/log/nginx /usr/share/nginx/html
EXPOSE 8080

USER nginx
CMD ["nginx", "-g", "daemon off;"]
