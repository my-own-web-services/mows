# 0. build stage
FROM scratch AS sources
COPY --from=filez-client-typescript . filez-client-typescript
COPY --from=filez-components-react . filez-components-react
COPY pnpm-workspace-docker.yaml ./pnpm-workspace.yaml


FROM node:23-alpine3.19 AS build-stage
WORKDIR /build
RUN yarn global add pnpm
COPY --from=sources / /build/
WORKDIR /build/filez-web
COPY package.json pnpm-lock.yaml ./

RUN pnpm install
COPY . .
RUN pnpm build

# 1. execution stage
FROM localhost:5000/feoco
COPY --from=build-stage /build/filez-web/dist/ /public/
COPY server/config.yml /
