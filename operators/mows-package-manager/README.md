`cargo run --bin cli -- template --uri=file:///home/paul/projects/mows/packages/core/auth/zitadel -n=abc -d > test.yaml`

# packages

1. A package can only be installed in one namespace (exceptions apply for core packages)

2. A package can have multiple sources for generation at the same time (helm, kustomize, plain, etc.)

3. A package needs to have all remote resources verified by checksum

4. see examples/repos/zitadel



# utoipa axum quirks

## 1. the subpath of the router cannot be a slash, it must be an empty string to match the parent route

we want to reach the health endpoint on `/api/health/` 

*main.rs*
```rs
let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .nest("/api/health", health::router())
        ...
```

**CORRECT**
```rs
    #[utoipa::path(
        get,
        path = "",
        responses(
            (status = 200, description = "Got health", body = ApiResponse<HealthResBody>),
        )
    )]
```
**INCORRECT (FAILS SILENTLY)**
```rs
    #[utoipa::path(
        get,
        path = "/",
        responses(
            (status = 200, description = "Got health", body = ApiResponse<HealthResBody>),
        )
    )]
```



## 2. for multiple routes the route function must be called multiple times, the routes! macro is not supported for multiple routes

**CORRECT**
```rs
    OpenApiRouter::new()
        .routes(routes!(delete_machine))
        .routes(routes!(create_machines))
        .routes(routes!(signal_machine))
        .routes(routes!(get_machine_info))
        .routes(routes!(get_vnc_websocket))
        .routes(routes!(get_machine_status))
        .routes(routes!(dev_delete_all_machines))
```

**INCORRECT**
```rs
OpenApiRouter::new().routes(routes!(delete_machine, create_machines, signal_machine, get_machine_info, get_vnc_websocket, get_machine_status, dev_delete_all_machines))
```