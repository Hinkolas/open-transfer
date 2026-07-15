FROM oven/bun:1 AS base
WORKDIR /app

# all deps (vite build needs devDependencies)
FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=install /app/node_modules node_modules
COPY . .
RUN bun run build

# only "dependencies" — adapter-node externalizes these, everything else is bundled
FROM base AS prod-deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=prod-deps /app/node_modules node_modules
COPY --from=build /app/build build
# migrations are applied at boot from this folder
COPY drizzle drizzle
COPY package.json ./
USER bun
EXPOSE 3000
CMD ["bun", "build/index.js"]
