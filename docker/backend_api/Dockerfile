FROM node:24-alpine AS dependencies

ENV NODE_ENV=production
WORKDIR /app
COPY backend_api/package.json backend_api/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3001
WORKDIR /app

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node backend_api/package.json backend_api/package-lock.json ./
COPY --chown=node:node backend_api/index.js ./index.js

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/test || exit 1

CMD ["node", "index.js"]
