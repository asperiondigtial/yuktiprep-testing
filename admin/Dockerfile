FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Argument allows passing API URL at build time for client-side bundle
ARG NEXT_PUBLIC_API_URL=https://ba.yuktiprep.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG NEXT_PUBLIC_OCR_API_URL=https://ba.yuktiprep.com/ocr
ENV NEXT_PUBLIC_OCR_API_URL=$NEXT_PUBLIC_OCR_API_URL

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5000
ENV HOSTNAME="0.0.0.0"

RUN apk add --no-cache libc6-compat=<version> && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs --from=builder /app/.next ./.RUN apk add --no-cache libc6-compat=<version> && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

USER nextjs

EXPOSE 5000

CMD ["npm", "run", "start", "--", "-p", "5000", "-H", "0.0.0.0"]
