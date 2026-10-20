FROM node:20-alpine

WORKDIR /app

# System deps for native modules and Prisma
RUN apk add --no-cache openssl libc6-compat ca-certificates

# Install dependencies first (better layer caching)
COPY package*.json ./
COPY prisma ./prisma/

# npm ci = clean, reproducible install from package-lock.json
# (devDependencies are kept here because the prisma CLI is needed)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code, owned by the non-root user
COPY --chown=node:node . .

# Give the non-root user ownership of the app directory
# (needed if the app writes uploads, logs or temp files)
RUN chown node:node /app

# Set runtime env AFTER install, so devDependencies aren't skipped
ENV PORT=4000
ENV NODE_ENV=production

EXPOSE 4000

# Run as non-root (fixes DS-0002). The official node image already ships the "node" user.
USER node

CMD ["node", "index.js"]
