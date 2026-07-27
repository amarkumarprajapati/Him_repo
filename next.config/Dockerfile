# Stage 1: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Copy node_modules from host to bypass potential network/DNS issues
COPY node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=30301
ENV HOSTNAME="0.0.0.0"

# Copy build artifacts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 30301

CMD ["node", "server.js"]
