# 0. build stage
FROM node:21-alpine as build-stage
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn
RUN yarn add sharp @img/sharp-linuxmusl-x64 --ignore-engines
COPY . .
RUN yarn build

# 1. execution stage
FROM pektin/feoco
COPY --from=build-stage --chown=feoco /app/dist/ /public/
COPY server/config.yml /
EXPOSE 80
