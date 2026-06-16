FROM golang:1.22-bookworm AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY ent ./ent
COPY internal ./internal
COPY migrations ./migrations
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/medopl-go-backend ./cmd/server

FROM debian:12-slim

ENV MEDOPL_BACKEND_PORT=8080
WORKDIR /app
COPY --from=build /out/medopl-go-backend /usr/local/bin/medopl-go-backend
EXPOSE 8080

USER nobody
ENTRYPOINT ["/usr/local/bin/medopl-go-backend"]
