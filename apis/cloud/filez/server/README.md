```sh
kubectl patch crd/filezresources.filez.k8s.mows.cloud -p '{"metadata":{"finalizers":[]}}' --type=merge ; kubectl delete filezresources.filez.k8s.mows.cloud --all ; kubectl delete crd filezresources.filez.k8s.mows.cloud

```

## Important to reduce headaches

1. Don't call first() even when only 1 record is expected to exist, call limit(2) and return an error if multiple exist. This makes follow up errors easier to catch. This should only be omitted on queries that are ensured by the database to be unique.

2. Mark all models with #[diesel(treat_none_as_null = true)] so that changeset fields are nulled again when set to none, TODO: Handle behavior in all update methods
