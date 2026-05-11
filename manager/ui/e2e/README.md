# manager-ui e2e tests

Playwright tests for the manager UI. The webServer config auto-starts (or
reuses) `pnpm dev` on port 5173. All backend HTTP/WS calls are stubbed in
the tests themselves, so no Rust server is required.

## Running

```sh
pnpm test:e2e
pnpm test:e2e:ui   # interactive runner
```

## NixOS

Playwright's bundled browsers are not FHS-compliant and won't launch on
NixOS out of the box (`libnspr4.so` missing, etc.). Point Playwright at a
nix-managed browser instead:

```sh
nix-shell -p chromium --run \
  "PLAYWRIGHT_CHROMIUM_PATH=\$(which chromium) pnpm test:e2e"
```

`PLAYWRIGHT_FIREFOX_PATH` works the same way and switches the project to
Firefox. If neither var is set the config falls back to Playwright's
bundled chromium-headless-shell, which is what CI uses.
