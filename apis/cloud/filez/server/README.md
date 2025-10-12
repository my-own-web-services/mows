```sh
kubectl patch crd/filezresources.filez.k8s.mows.cloud -p '{"metadata":{"finalizers":[]}}' --type=merge ; kubectl delete filezresources.filez.k8s.mows.cloud --all ; kubectl delete crd filezresources.filez.k8s.mows.cloud

```

## Important to reduce headaches

1. Don't call first() even when only 1 record is expected to exist, call limit(2) and return an error if multiple exist. This makes follow up errors easier to catch. This should only be omitted on queries that are ensured by the database to be unique.

2. Mark all models with #[diesel(treat_none_as_null = true)] so that changeset fields are nulled again when set to none, TODO: Handle behavior in all update methods

# Access Control

# Entities

1. Human Users logged in through oauth
2. Apps
   2.1 Frontend Apps: That can only access resources and display them to the users if granted before by the user in combination with an oauth login/token
   2.2 Backend Apps: That authenticate with their kubernetes service account tokens and can act on behalf of the user if allowed to
3. API Users, that authenticate with an API token, they are created by a user and are allowed access to resources by the user
4. User Groups: User inherit allowances from their groups, if the group has access to it, they have

# Resources

1. Resources: Entities can be given access to resources depending on the actions
2. Resource Groups: Resources can be part of resource groups, if access is given to a resource group the resource inherits it

ReBAC

Evaluate policies beforehand for every resource for speed
