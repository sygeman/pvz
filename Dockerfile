FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install

# Copy source
COPY . .

# Build TypeScript
RUN bun run build

# Build client
RUN cd client && bun install && bun run build

# Expose port
EXPOSE 3000

# Start server
CMD ["bun", "run", "dist/index.js"]