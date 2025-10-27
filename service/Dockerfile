# Use official Go image as build stage
FROM golang:1.24-alpine AS builder

# Install build dependencies (gcc is needed for go-sqlite3)
RUN apk add --no-cache gcc musl-dev sqlite-dev

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY main.go ./

# Build the application
RUN CGO_ENABLED=1 GOOS=linux go build -o service main.go

# Use minimal alpine image for runtime
FROM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache sqlite-libs

# Set working directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/service .

# Create data directory structure
RUN mkdir -p data/uploads

# Expose port 3000
EXPOSE 3000

# Run the application
CMD ["./service"]
