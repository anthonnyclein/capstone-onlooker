# Multi-stage production Dockerfile for Dokploy / Docker deployment
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (including devDependencies required for Vite build)
COPY package*.json ./
RUN npm ci

# Copy source code and build client
COPY . .
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built frontend assets
COPY --from=builder /app/dist ./dist

# Copy backend server code, schema, types, and initial data
COPY server ./server
COPY data ./data
COPY src/types.ts ./src/types.ts
COPY tsconfig.json ./

EXPOSE 3000

CMD ["npm", "start"]

