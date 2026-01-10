# tab lines

# brighter colors

# suggestions

# file linting based on schema

# warning for empty variables

# template before and after render line comparison side by side

# true and := coloring

# more spaces than allowed per tab wrong error location

```yaml
version: "3.9"

services:
    qa-web:
```

```
error: indentation error
  --> results/docker-compose.yml:33:5

 26 │ ····························entrypoints:·web
 27 │ ····························service:·qa-web
 28 │ ····················services:
 29 │ ························qa-web:
 30 │ ····························loadbalancer:
 31 │ ································server:
 32 │ ····································port:·80
 33 │ ····qa-server:  indentation error
 34 │ ········build:
 35 │ ············context:·../../server/
 36 │ ············dockerfile:·Dockerfile
 37 │ ········
 38 │ ········container_name:·qa-server
 39 │ ········networks:
 40 │ ············-·qa-db
 41 │ ············-·qa-interossea-server
```
