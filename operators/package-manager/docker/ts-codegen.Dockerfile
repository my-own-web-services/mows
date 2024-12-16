FROM node
WORKDIR /app
RUN yarn add swagger-typescript-api

RUN echo "npx swagger-typescript-api -p ./swagger.json -o ./out/ -n api-client.ts" > gen.sh
ENTRYPOINT ["sh","gen.sh"]