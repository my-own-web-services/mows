# 0. build stage
FROM node:16.13.0-alpine3.14 as build-stage
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn
COPY . .
RUN yarn build

# 1. execution stage
FROM pektin/feoco
COPY --from=build-stage /app/dist/ /public/
COPY server/config.yml /
EXPOSE 80
