# 0. build stage
FROM node:23-alpine3.19 AS build-stage
WORKDIR /app
RUN yarn global add pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .
RUN pnpm build

# 1. execution stage
FROM pektin/feoco
COPY --from=build-stage /app/dist/ /public/
COPY server/config.yml /
