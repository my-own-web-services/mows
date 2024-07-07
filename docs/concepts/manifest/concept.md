- every app lives in its own namespace
- the namespaces are labeled as app namespace
- every resource in an app labeled namespace is allowed and denied different resources, per default none, so any deployment or other resource will be rejected
- slowly we are allowing certain rules


security failure modes
- network
    - ingress/egress -> easy to limit
    - dns -> every app has its own subdomain
    - api access -> easy to limit with proper api access control system something like kong?
    
- compute resources -> easy to limit

- data
    - secrets
    - config
    - storage -> capacity limited and access limited to own persistent volumes in namespace

kyverno looks interesting for securing standard helm deployments


example gitea:

- rp
    - routing info setup
    - network connection

- postgres
    - network connection
    - db setup
    - connection info and credentials

- basic dns setup

- data volume

- smtp access

- shh tcp port


repository (official) or (unofficial) 

mows applications -> mows package manager -> makes only safe things representable -> apply

helm applications -> overlay to configure dns/rp etc. -> enforce rules based kyverno -> apply

pg operator