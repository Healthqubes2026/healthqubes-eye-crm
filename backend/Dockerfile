FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies layer (cached unless package.json changes)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Create upload directories
RUN mkdir -p uploads/selfies uploads/meetings uploads/reports logs

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "src/server.js"]
