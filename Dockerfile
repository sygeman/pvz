FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./
COPY client/package.json client/bun.lockb* ./client/

# Install dependencies
RUN bun install
RUN cd client && bun install

# Copy source
COPY . .

# Build client
RUN cd client && bun run build

# Expose port
EXPOSE 3000

# Start server
CMD ["bun", "run", "server.js"]
