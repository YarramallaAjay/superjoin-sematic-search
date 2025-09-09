# Frontend Dockerfile for Next.js application
FROM node:24-alpine

WORKDIR /app

# Copy root package.json and lockfiles
COPY package*.json ./
COPY turbo.json ./

# Copy workspace configurations
COPY apps/ui/package*.json ./apps/ui/
COPY packages/database/package*.json ./packages/database/
COPY packages/llm-config/package*.json ./packages/llm-config/

# Install dependencies for all workspaces
RUN npm install

# Copy package source code
COPY packages/ ./packages/
COPY apps/ui/ ./apps/ui/

# Build packages first
RUN cd packages/database && npm run build
RUN cd packages/llm-config && npm run build

# Set working directory to frontend app
WORKDIR /app/apps/ui

# Expose port
EXPOSE 5000

# Add development user for better security and file permissions
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app
USER nextjs

# Default command (can be overridden by docker-compose)
CMD ["npm", "run", "dev:ui"]