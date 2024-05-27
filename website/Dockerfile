# 0. build stage
FROM node:21-alpine as build-stage
RUN npm i --location=global pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .
RUN pnpm build

# 1. execution stage
FROM pektin/feoco
COPY --from=build-stage --chown=feoco /app/dist/ /public/
COPY server/config.yml /
EXPOSE 80
