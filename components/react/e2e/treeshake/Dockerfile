FROM node:22-alpine

RUN apk add --no-cache bash coreutils
RUN corepack enable

WORKDIR /work

# The consumer skeleton (deps + scenario sources) is baked into the image.
# The library tarball is mounted at runtime under /lib so a fresh build is
# always used without rebuilding the image.
COPY consumer/ ./consumer/
COPY docker-entrypoint.sh /usr/local/bin/treeshake-entrypoint
RUN chmod +x /usr/local/bin/treeshake-entrypoint

# Pre-install consumer deps that DO NOT include the lib tarball. The
# tarball is added by the entrypoint at runtime so the image stays cached
# across lib changes.
WORKDIR /work/consumer
RUN pnpm install --ignore-scripts

WORKDIR /work
ENTRYPOINT ["treeshake-entrypoint"]
