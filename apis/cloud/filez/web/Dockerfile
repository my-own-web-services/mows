# 0. build stage
FROM scratch AS sources
COPY --from=filez-client-typescript . filez-client-typescript
COPY --from=filez-components-react . filez-components-react


FROM node:23-alpine3.19 AS build-stage
WORKDIR /build
RUN yarn global add pnpm
WORKDIR /build/filez-web
COPY --from=sources / .yalc/

COPY package.json pnpm-lock.yaml ./

RUN pnpm install
COPY . .
RUN pnpm build

# 1. execution stage
FROM localhost:5000/feoco
COPY --from=build-stage /build/filez-web/dist/ /public/
COPY server/config.yml /
