# creating of secret engines
path "sys/mounts/mows-core-secrets-vrc/*" {
  capabilities = ["create","update"]
}

# listing secret engines
path "mows-core-secrets-vrc/*" {
  capabilities = [ "read"]
}
path "sys/mounts" {
  capabilities = [ "read"]
}

# listing auth engines
path "sys/auth" {
  capabilities = [ "read"]
}

# creating auth engines
path "sys/auth/mows-core-secrets-vrc/*" {
  capabilities = ["create", "update","sudo"]
}

# create and list policies
path "sys/policy/mows-core-secrets-vrc/*" {
  capabilities = ["create","update"]
}
path "sys/policy" {
  capabilities = ["list","read"]
}
