# security

1. path traversal attacks ../../


# replacements


not directly replaced but filled into the defaults of config in the ui
cluster.public_ip
cluster.public_legacy_ip
cluster.domain, can be adjusted

config.organization





deploy gitea
- select org: qa, or firstdorsal
- use default subdomain for chart, in this case gitea
- use primary domain of org as default or any other domain that we know of
namespace will be created as mows-app-ORGNAME-deploymentname, mows-app-qa-gitea







# flow

## adding repository (git)

- add repo (default official mows repo)
- in the repo are folders with manifest + additional files
- the manifests give information about the location and method to get the k8s resource files
- pull the metadata when indexing the list


## generating resources
- with helm or nix or anything else that we support

## applying resources
### how to store generated secrets
1. push helm generated secrets to vault and create a secret sync
2. apply the secrets to cluster without modification

### target 
1. git -> argocd/flux
2. direct kubectl apply -> real state is only stored in kubernetes
2.1 real eventual consistency (prevent resources that fail to get pushed for some reason, better retry logic), resolve unknown k8s custom resources and install them
2.2 visual drag and drop k8s resources to play around 






---
in the folder is:

*manifest.yaml*
```yaml
manifestVersion: "0.1"
name: zitadel
version: "0.0.1"
app:
    raw:
        helmRepos:
            -   repository: https://charts.zitadel.com # from /index.yaml we can fetch a list of all chart releases
                chartName: zitadel
                digest: ff694231bbb1cda83c30dbff65c78f11ee4b2adeb81c438e3be6901c4821884a # is a sha256sum, we can find the release by searching for this, the we get meta infos as well as the download url for the tgz file, the checksums must match, the we unpack and render the helm chart, similar to kustomizations but with checking the digest
                valuesFile: values.yaml
                resources:
                    - DnsRecord.yaml
                    - IngressRoute.yaml
```
*values.yaml*

*DnsRecord.yaml*

*IngressRoute.yaml*

---
## install
- click install in the list of applications
- helmRepo is pulled, checked for its digest, basic cluster variables are replaced throughout, then its rendered
- the admin gets to see a summary of the to be installed resources and can adjust namespace resource quotas, etc.
- a commit is created and made ready for the admin to sign it

- the admin signs it and it is pushed to their own gitea
- an argocd app definition is created, argocd pulls the repo verifies the commit and updates the cluster










# Methods of deployment

## manual imperative local kubectl or helm

-   no versioning
-   no safety guarantees but the ones provided by the admission controller (kyverno (can be skipped by labeling the namespace))

## declarative manual administered argocd

-   manual commit
-   manual argocd app definition
-   commit signing
-   no safety guarantees but the ones provided by the admission controller (kyverno (can be skipped by labeling the namespace))

## mows raw

-   primarily for apps that aren't build for mows directly
-   allows every k8s resource directly
-   must comply with mows standards to properly integrate with all other components, won't be checked (maybe warned)
-   by default completely namespace isolated, network, k8s resources, secrets, namespace resource quotas
-   everything is possible but must be declared and allowed by the admin to loosen restrictions like network isolation

### deployment process

1. get files from repo or url or fs or similar (helm values, dnsRecord, ingressroute etc.)
2. render helm
3. replace variables from vault (domain names, actual service names etc.)
4. ensure safety (ensure all resource have the correct namespace, confirm mows sudo actions)
5. commit to git (and sign with admins key)
6. create argocd app definition and push it to the cluster
7. sync to cluster with argocd (check signing key)

## mows app

-   simplified deployment for apps that are build for mows with a custom manifest that then gets expanded to raw k8s resources
-   automatic setup of internal network policies etc. (app needs a pg-db, db is deployed and network policies that only allow the app talking to the db are applied)
-   no manual setup of secrets for app and db
-   automatic resource setup for auth, metrics, tracing etc.
-   mows app can be rendered into raw resources to be used by more complex apps built with mows raw

### deployment process

After creating the raw k8s resources from the mows app manifest, the deployment follows the same process as the raw app
