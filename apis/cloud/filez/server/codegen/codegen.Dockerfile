FROM node:23.9.0-alpine3.21@sha256:191433e4778ded9405c9fc981f963ad2062a8648b59a9bc97d7194f3d183b2b2
WORKDIR /app
RUN yarn global add pnpm
COPY ./ts .
RUN pnpm install
ENTRYPOINT ["pnpm","generate"]