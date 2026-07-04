# Multi-stage build: compile in a full Node image, run in a slim one, so the
# shipped image doesn't carry the whole build toolchain - smaller image,
# smaller attack surface.
FROM node:20-slim AS build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/backend/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
