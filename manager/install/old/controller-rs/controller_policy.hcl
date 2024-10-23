path "sys/mounts/mows-core-secrets-vrc/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "sys/auth/mows-core-secrets-vrc/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "sys/policies/acl/*" {
  capabilities = ["create"]
}

#https://stackoverflow.com/questions/61464978/hashicorp-vault-restrict-rights-given-by-policy-for-user-allowed-to-create-poli
