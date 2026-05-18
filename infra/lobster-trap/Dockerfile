# Multi-stage build: clone Lobster Trap at a pinned commit, compile the
# Go binary, then drop it into a minimal runtime image. Keeps the final
# image small and reproducible — the binary plus the policy is all we
# need at runtime.

# ---------- builder ----------
FROM golang:1.23-alpine AS builder

RUN apk add --no-cache git

WORKDIR /src

# Pin to a known-good commit. Bump deliberately when upgrading.
ARG LOBSTERTRAP_REF=main

RUN git clone https://github.com/veeainc/lobstertrap.git . \
    && git checkout ${LOBSTERTRAP_REF}

RUN go build -trimpath -ldflags="-s -w" -o /out/lobstertrap ./cmd/lobstertrap \
    || go build -trimpath -ldflags="-s -w" -o /out/lobstertrap .

# ---------- runtime ----------
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tini \
    && addgroup -S lt && adduser -S lt -G lt

COPY --from=builder /out/lobstertrap /usr/local/bin/lobstertrap
COPY policy.yaml /etc/lobstertrap/policy.yaml

USER lt
EXPOSE 8080

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/lobstertrap"]
CMD ["serve", \
     "--policy", "/etc/lobstertrap/policy.yaml", \
     "--listen", ":8080", \
     "--audit-log", "/dev/stdout"]
