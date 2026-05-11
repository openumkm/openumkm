FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
# Explicitly copy static assets that nest build may not copy on Linux
COPY --from=builder /app/src/views ./dist/views
COPY --from=builder /app/src/public ./dist/public
COPY --from=builder /app/src/locales ./dist/locales
COPY --from=builder /app/src/mail ./dist/mail
# Copy migration SQL files so drizzle migrator can find them at runtime
COPY --from=builder /app/src/db/migrations ./dist/db/migrations
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
