# MOWS Manager

The Manager handles all operations that cannot be performed inside the cluster.

Operations include:

-   System Install
-   Exchange of hardware parts
-   Creating external machines for example for the static IP proxy
-   Creating virtual environments for development

The Manager is nearly stateless and only operates on one single JSON Structure that gets modified and populated with all secret keys and other required information. This text should be stored in a password manager or similar. When the manager is used again, this information blob needs to be provided.

In development this blob can be persisted and reloaded from the browsers local storage between manager restarts. THIS IS INSECURE TO USE IN PRODUCTION

# Usage

## Production

### Requirements

-   Linux (For other OS see the issues below)
-   Docker

## Development

### Requirements

-   Linux (For other OS see the issues below)
-   Docker
-   Rust Toolchain
-   nodejs
-   pnpm

### Run it!

#### Manual

From the manager folder run: `bash scripts/start-manager.sh`

If you want to create local VMs for testing run: `bash scripts/start-peripherals.sh`

From the manager/ui folder run: `pnpm dev` to start the ui

Open `http://localhost:5173/dev/`

#### Codium/VSCode

Install the recommended extensions, from `.vscode/extensions.json`

With `ethansk.restore-terminals` the commands above will be executed once vscode is started

# Issues

## Windows or Mac

Windows/Mac will currently not work out of the box. A virtualization solution other than KVM needs to be added to create the development VMs. Networking and other things need to be adjusted.

## argo kustomize error

Hi everyone!
When using argocd to deploy ESO with kustomize and helm and then updating the version number of the chart it doesn't get updated by argo. Even when deleting the application and re-creating it it still deploys the old chart. I manually pressed refresh and argo is pulling in the right git commit with the new version number. when manually applying the Kustomization with k kustomize --enable-helm /install/core/secrets/eso/ | kubectl apply --server-side -f - it works. Any Idea why this doesn't work? Thank you!

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
    - namespace.yaml
    - VaultAuth.yaml
    - SecretStore.yaml
helmGlobals:
    chartHome: /tmp/helm-charts
helmCharts:
    - name: external-secrets
      repo: https://charts.external-secrets.io
      version: 0.10.5 # this got changed from 0.10.4
      releaseName: mows-core-secrets-eso
      includeCRDs: true
      namespace: mows-core-secrets-eso
      valuesFile: values.yaml
project: mows-core
```

```yaml
source:
    repoURL: "https://git.vindelicum.eu/firstdorsal/mows.git"
    path: manager/install/core/secrets/eso
    targetRevision: HEAD
destination:
    namespace: mows-core-secrets-eso
    name: in-cluster
syncPolicy:
    automated:
        prune: true
        selfHeal: true
    syncOptions:
        - CreateNamespace=true
        - ServerSideApply=true
        - RespectIgnoreDifferences=true
    retry:
        limit: 10
        backoff:
            duration: 5s
            factor: 2
            maxDuration: 3m
```

```json
{
    "Version": "v2.11.5+c4b283c",
    "BuildDate": "2024-07-15T17:39:54Z",
    "GitCommit": "c4b283ce0c092aeda00c78ae7b3b2d3b28e7feec",
    "GitTreeState": "clean",
    "GoVersion": "go1.21.10",
    "Compiler": "gc",
    "Platform": "linux/amd64",
    "KustomizeVersion": "v5.2.1 2023-10-19T20:13:51Z",
    "HelmVersion": "v3.14.4+g81c902a",
    "KubectlVersion": "v0.26.11",
    "JsonnetVersion": "v0.20.0"
}
```
