# Stage 1: Build client and server
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci

COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Install build tools for better-sqlite3 native rebuild
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# Clean up build tools to reduce image size
RUN apt-get purge -y python3 make g++ && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# Copy built artifacts
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/dist ./server/dist

# Ensure data directory exists for SQLite
RUN mkdir -p /app/data

EXPOSE 8080
CMD ["node", "server/dist/index.js"]
