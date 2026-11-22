FROM node:24-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate
WORKDIR /app

FROM base AS development-dependencies
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS production-dependencies
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

FROM base AS build
ARG VITE_API_BASE_URL_OVERRIDE=
COPY --from=development-dependencies /app/node_modules ./node_modules
COPY frontend/ ./
COPY frontend/.env.docker ./.env
RUN if [ -n "$VITE_API_BASE_URL_OVERRIDE" ]; then \
      export VITE_API_BASE_URL="$VITE_API_BASE_URL_OVERRIDE"; \
    fi && \
    pnpm run build

FROM base AS runtime

ENV HOST=0.0.0.0 \
    NODE_ENV=production \
    PORT=5173

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/build ./build
COPY --chown=node:node frontend/package.json frontend/pnpm-lock.yaml ./

USER node
EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5173/ || exit 1

CMD ["./node_modules/.bin/react-router-serve", "./build/server/index.js"]
