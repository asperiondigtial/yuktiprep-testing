FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat=1.2.5-r0

COPY package*.json ./
RUN npm install

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Argument allows passing API URL and keys at build time
ARG NEXT_PUBLIC_BACKEND_URL=https://ba.yuktiprep.com
ARG NEXT_PUBLIC_RAZORPAY_KEY_ID=""
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_RAZORPAY_KEY_ID=$NEXT_PUBLIC_RAZORPAY_KEY_ID

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5001
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache libc6-compat=1.2.5-r0 \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs --from=builder /app/.next ./.next

USER nextjs

EXPOSE 5001

CMD ["npm", "run", "start", "--", "-p", "5001", "-H", "0.0.0.0"]
