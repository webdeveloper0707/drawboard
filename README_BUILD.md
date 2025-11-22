# Build Instructions

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev:server
```

## Production Build

### Standalone Build

1. **Build the application:**
   ```bash
   npm run build:standalone
   ```

2. **Start the production server:**
   ```bash
   npm run start
   ```

   Or set environment variables:
   ```bash
   NODE_ENV=production PORT=3101 npm run start
   ```

### Build Output

The standalone build creates an optimized production build in `.next/standalone` directory. This includes:
- Minimal server files
- Optimized static assets
- All required dependencies

### Deployment

For deployment, you need:
1. `.next/standalone` directory (from build)
2. `.next/static` directory (from build)
3. `public` directory (if you have static files)
4. `node_modules` with production dependencies
5. `server.js` file
6. `package.json` file

### Environment Variables

- `NODE_ENV`: Set to `production` for production builds
- `PORT`: Server port (default: 3101)
- `HOSTNAME`: Server hostname (default: 0.0.0.0)
- `NEXT_PUBLIC_SOCKET_URL`: Socket.io server URL (optional, auto-detected)
- `NEXT_PUBLIC_SOCKET_PORT`: Socket.io server port (default: 3101)

### Docker Deployment (Optional)

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build:standalone

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3101

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.js ./
COPY --from=builder /app/package.json ./

USER nextjs

EXPOSE 3101

CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t drawboard-app .
docker run -p 3101:3101 drawboard-app
```

