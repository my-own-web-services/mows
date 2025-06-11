FROM node:23.9.0-alpine3.21@sha256:191433e4778ded9405c9fc981f963ad2062a8648b59a9bc97d7194f3d183b2b2
WORKDIR /app
RUN yarn add swagger-typescript-api

RUN echo "npx swagger-typescript-api -p ./openapi.json -o ./out/ -n api-client.ts" > gen.sh
ENTRYPOINT ["sh","gen.sh"]