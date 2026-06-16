FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html postcss.config.mjs tsconfig.app.json tsconfig.json tsconfig.node.json vite.config.ts ./
COPY src ./src
RUN npm run build

FROM nginx:1.27-bookworm

COPY --from=build /app/dist /usr/share/nginx/html
RUN printf '%s\n' \
  'server {' \
  '  listen 8080;' \
  '  server_name _;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '  location / {' \
  '    try_files $uri $uri/ /index.html;' \
  '  }' \
  '}' \
  > /etc/nginx/conf.d/default.conf \
  && chown -R nginx:nginx /var/cache/nginx /var/run /var/log/nginx /etc/nginx/conf.d /usr/share/nginx/html
EXPOSE 8080

USER nginx
CMD ["nginx", "-g", "daemon off;"]
