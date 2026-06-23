FROM node:22-bookworm-slim AS portal-build

WORKDIR /src/services/portal/frontend
COPY services/portal/frontend/package.json services/portal/frontend/package-lock.json ./
RUN npm ci
COPY services/portal/frontend/index.html services/portal/frontend/postcss.config.mjs services/portal/frontend/tsconfig.app.json services/portal/frontend/tsconfig.json services/portal/frontend/tsconfig.node.json services/portal/frontend/vite.config.ts ./
COPY services/portal/frontend/src ./src
RUN npm run build

FROM golang:1.22-bookworm AS build

WORKDIR /src/services/medopl-go-backend
COPY services/medopl-go-backend/go.mod services/medopl-go-backend/go.sum ./
RUN go mod download
COPY services/medopl-go-backend/cmd ./cmd
COPY services/medopl-go-backend/ent ./ent
COPY services/medopl-go-backend/internal ./internal
COPY services/medopl-go-backend/migrations ./migrations
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/medopl-go-backend ./cmd/server

FROM debian:12-slim

ENV MEDOPL_BACKEND_PORT=8080
ENV MEDOPL_PORTAL_STATIC_ROOT=/app/portal
WORKDIR /app
COPY --from=build /out/medopl-go-backend /usr/local/bin/medopl-go-backend
COPY --from=build /src/services/medopl-go-backend/migrations /app/migrations
COPY --from=portal-build /src/services/portal/frontend/dist /app/portal
EXPOSE 8080

USER nobody
ENTRYPOINT ["/usr/local/bin/medopl-go-backend"]
