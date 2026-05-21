FROM node:23.9.0-alpine3.21@sha256:191433e4778ded9405c9fc981f963ad2062a8648b59a9bc97d7194f3d183b2b2
WORKDIR /app
# Pin pnpm to the exact version declared in package.json's
# `packageManager` field. `yarn global add pnpm` (no version) used to
# resolve to whatever was latest at build time, defeating reproducibility
# (DEVOPS-19). Using corepack matches the canonical Node.js workflow and
# pins to the sha-stamped version line for free.
RUN corepack enable && corepack prepare pnpm@9.1.3 --activate
COPY package.json pnpm-lock.yaml ./
# `--frozen-lockfile` makes pnpm fail loudly if the lockfile is out of sync
# with package.json, preventing silent dependency drift in the generated
# TS client (DEVOPS-18).
RUN pnpm install --frozen-lockfile
COPY . .
ENTRYPOINT ["pnpm","generate"]
