# **FEOCO `pektin/feoco`**

[git.y.gy](https://git.y.gy/pektin/feoco) | [GitLab](https://gitlab.com/pektin/feoco) | [GitHub](https://github.com/pektin-dns/feoco) | [dockerhub](https://hub.docker.com/r/pektin/feoco)

A container for serving **static** web applications, with **client side routing**, from memory. Intended for use behind a reverse proxy that handles routing and TLS termination.

Created to be a perfect match for serving preact/react/vue or similar apps.

# **1MB container size**

half of that comes from brotli support

# **~280k HTTP requests/second**

nginx does ~30k on the same machine

# automatic brotli, gzip or no compression depending on file type and browser support

# Note

This is **not** a fully featured web server for routing proxying or anything other than serving single page apps (that use client side routing).

# Easy Header configuration

## Simple variable replacement out of the box

You can use variables with the variable prefix from the config file:

`config.yml`

```yaml
# set prefix
variablePrefix: "$"
headers:
    all:
        someHeader: $MY_VAR # use variable with prefix from above
# ...
```

The variables will be replaced by the same variable name provided to the container environment.

So when the environment is provided like this...

`docker-compose.yml`

```yaml
version: "3.7"
services:
    feoco-app:
        build:
            context: .
            dockerfile: Dockerfile
        ports:
            - "8080:80"
        environment:
            - MY_VAR=hello
```

...the config from above will be rendered like so:

```yaml
variablePrefix: "$"
headers:
    all:
        someHeader: hello
# ...
```

## Set Headers on all requests and/or on the document separately

```yaml
variablePrefix: "$"
headers:
    # on every resource
    all:
        This-Header-Will-Be-Set: On All Served Resources
    # only on the document
    document:
        This-Header-Will-Only-Be-Set: On the document (index.html)
# prevent all matching paths from beeing served from memory and read them from disk instead; if the path is included it is matched
noMemory: []
```

# Getting started by Example

# IMPORTANT Things to know

All files will be read from the container directory: `/public/`
So you will have to put your files there. This cannot be configured.

The config is expected to be in the container at `/config.yml`
Not `.yaml` Not anywhere else.

An empty default config is mounted in the base image.
It looks like this:

```yaml
variablePrefix: "$"
headers:
    # on every resource
    all: {} # empty "rust hashmap" or "JS object"
    # only on the document
    document: {}
# prevent all matching paths from beeing served from memory and read them from disk instead; if the path is included it is matched
noMemory: []
```

Your config **has to contain the above fields at minimum**, else the server will not launch.

This image internally listens to port 80 on all interfaces `http://0.0.0.0:80`

It does **not** run as root.

### Your Apps Dockerfile

`Dockerfile`

```Dockerfile
# 0. your build stage
FROM node:16.13.0-alpine3.14 as build-stage

# Add additional needed software
RUN apk add git bash sed
WORKDIR /app

# Build deps
COPY package.json yarn.lock ./
RUN yarn

# Build your app
COPY . .
RUN sh scripts/install-modules.sh
RUN yarn build


# 1. execution stage; NOTE: You can't do much here as this is a image from scratch
FROM pektin/feoco
COPY --from=build-stage /app/build/ /public
COPY config.yml /config.yml
```

### Compose File

`docker-compose.yml`

```yaml
version: "3.7"
services:
    feoco-app:
        build:
            context: .
            dockerfile: Dockerfile
        ports:
            - "8080:80"
        environment:
            - CSP_CONNECT_SRC=*
```

### Config File

`config.yml`

```yaml
variablePrefix: "$"
headers:
    # on every resource
    all:
        Strict-Transport-Security: max-age=315360000; includeSubdomains; preload
        Cache-Control: public, max-age=31536000

    # only on the document
    document:
        # You can insert line breaks as you want; they will be removed when loading the config
        Content-Security-Policy: >-
            default-src 'none';

            script-src 'self' 'wasm-unsafe-eval' 'wasm-eval';
                        
            style-src 'self' 
            'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=' 
            'sha256-gixU7LtMo8R4jqjOifcbHB/dd61eJUxZHCC6RXtUKOQ=' 
            'sha256-Dn0vMZLidJplZ4cSlBMg/F5aa7Vol9dBMHzBF4fGEtk=' 
            'sha256-jX63Mkkw8FdoZGmV5pbbuvq3E6LQBUufPYlkJKSN5T4=' 
            'sha256-1Gz2g8CAv9x9EG1JNQpf4aunCZm7ce4CiOAYSHedtk8=' 
            'sha256-wWWgqv2I1eslvJWGxct2TL1YWfkLJFISQBUcrfymfYI=' 
            'sha256-AviY8ukUNt0M5R4KQLfmyNSp65NLzZO6kpngDHGe2f8='; 

            manifest-src 'self';

            connect-src $CSP_CONNECT_SRC; 

            img-src 'self'; 

            font-src 'self'; 

            base-uri 'none'; 

            form-action 'none'; 

            frame-ancestors 'none';
        x-frame-options: DENY
        x-content-type-options: nosniff
        x-permitted-cross-domain-policies: none
        x-download-options: noopen
        x-xss-protection: 1; mode=block
        referrer-policy: no-referrer
        permissions-policy: accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=(), clipboard-read=(), clipboard-write=(), gamepad=(), speaker-selection=(), conversion-measurement=(), focus-without-user-activation=(), hid=(), idle-detection=(), interest-cohort=(), serial=(), sync-script=(), trust-token-redemption=(), window-placement=(), vertical-scroll=()
# prevent all matching paths from beeing served from memory and read them from disk instead; if the path is included it is matched
noMemory: ["/volume/images/", ".jpg"]
```

# Thanks to

## [hyper](https://github.com/hyperium/hyper)

## [min-sized-rust](https://github.com/johnthagen/min-sized-rust)

## [serde](https://github.com/serde-rs/serde)

an all the other package authors of the packages found in the `Cargo.toml`

# License MIT

Copyright 2022 Paul Colin Hennig

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
