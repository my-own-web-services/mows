# MOWS - My Own Web Services

## What is MOWS?

MOWS aims to be a self-hosted cloud "operating system" focused on privacy, security, ease of use (for users and developers) and expandability, leveraging the web platform as well as the cloud native landscape without creating a real vendor lock in as everything is open source and free as in freedom.

-   MOWS is a platform to develop, deploy and use web apps that abstracts away the more nasty parts that application developers and users don't want to worry about
-   MOWS is intended to be self-hosted, either at home at your business or in the "cloud" (on vms or dedicated servers NOT expensive managed Kubernetes)
-   MOWS delivers an ecosystem of primitives that are required for building and deploying complex (web)apps with ease and without relying on big tech oligopolies
-   MOWS eliminates the need to reinvent the wheel for the same basic things all the time, authentication, persisting data, real time features and much more
-   MOWS is opinionated but flexible, you can develop services in any language as long as they can be run in one or multiple containers/VMs
-   MOWS provides strong security, uptime, and privacy guarantees by leveraging the huge Linux, Kubernetes and Web ecosystems
-   MOWS is open source and built on the shoulders of giants: Linux, KVM, Kubernetes, Kairos, Rust and many many more
-   MOWS doesn't compromise on hosting everything yourself, E-Mail, DNS, certificate management and much more are all provided directly as a basis to build on
-   MOWS provides ready-made solutions for all your self-hosting needs: backups, low maintenance, ease of use, reliability, and expandability
-   MOWS is intended to run your own highly available, efficient, low cost datacenter at home or anywhere else
-   MOWS is intended to be your single source of truth when deploying apps, virtual machines, creating, backups etc. like a real operating system but integrating in the multi device ecosystem of today

## How?

### Reliability & Expandability

Clustering multiple "weaker" machines to create a more reliable even stronger expandable "machine" using Kubernetes

### Security

Zero trust application deployments by using network and resource isolated micro VMs with minimum overhead

### Compatibility

The primary focus is to deploy applications using the web platform as it is the largest, most compatible ecosystem that we have.
The most desktop applications and mobile apps are using the web platform anyway, and then they're either sending your data to the service provider or persisting them to your local disk that you then have to back up and sync yourself with all your other more or less compatible devices. With a backing one stop solution for files, you can quickly develop and use reliable, automatically synchronizing, secure, non privacy invasive software. Now if you rely on some legacy desktop application, you can still run it in a streamed VM that is also backed up and has all the other benefits that VMs provide like cloning, snapshots and many more. You can use everything from Windows 11 down to Temple OS side by side, making the most of your hardware. Furthermore it is possible to integrate the MOWS file service with your existing native operating systems with a file sync client and much more.

### Ease of use

The MOWS ecosystem is opinionated to never sacrifice security, privacy or ease of use as well as enforcing these principles when creating apps.
To not butcher the developer experience, many problems that occur when applying these principles are abstracted away by the system or the tooling we provide.

## Why?

Live is complex enough and I as an application developer and perfectionist didn't want to cut down on half-baked solutions for my problems. Don't get me wrong, many of the solutions below are great, but they either didn't fully fit my use cases, are non-free (as in freedom), are reinventing the wheel or can't really be expanded on.

### Why not...

#### ...use the cloud or company provided web applications?

There is no cloud, just someone else's machine, that can disappear any time that you have no control over and that is either expensive, very slow or paid with your data.

#### ...docker compose on one machine?

Been there done that, for a long time without many issues, running things like email, websites for friends and non-profit organizations, home automation and DNS resolution and blocking on it. As these services got more important and heavier relied upon, uptime became a bigger and bigger concern. I was looking forward to starting my year 2024 by working on my cloud/file system (Now a part of the MOWS APIs), and instead got home from my vacation after New Year's Eve and had to fix my crashed server (Boot SSD died). The problem of boot drives dying and systems rotting away beneath my feet is one that happens all the time and I hate to be bothered with when I just want to get work done. Of course, you could use something like raid 1 for this exact problem by destroying even more SSDs by writing to them in parallel and then have them failing at almost the same time. Even if this was a good solution, what about a failing power supply, degraded RAM or something else going wrong in the machine? Also, what if the machine's RAM is suddenly completely used by the second or third java application that you are running? With using multiple machines with Kubernetes to create a bigger machine, you create a way more reliable system that you can even scale up or down depending on your needs, sharing your hardware with friends and family.
Kubernetes is here to stay, and its features and community enable so many more things than the docker/compose ecosystem that lacks many fundamental features like proper network or resource isolation. MOWS is here to bridge the gap between the complicated kubernetes setup and ecosystem towards software that is easy to build, deploy and use.

#### ...use Proxmox?

Proxmox is great but did not fulfill my requirement to run containers in lightweight virtual machines like Kata. It also can't profit from the growing Kubernetes ecosystem, as it's using its own HA strategy.
With MOWS you can run containers/pods side by side with heavy fully featured virtual machines and lightweight isolated VMs like Kata.

#### ...use Harvester?

Harvester was almost everything that I wanted, but is not meant to run Kata VMs side by side with fully featured VMs.

Their approach is to host a Kubernetes cluster with containers inside a Kubernetes cluster made of VMs.
This approach does not allow for managing Kata VMs without the use of nested virtualization, what makes everything more complicated and less efficient as well as introducing possible security issues.

## Components

-   Kubernetes based OS with opinionated configs
-   System components like storage drivers, network drivers, observability, virtualization and more taken from great projects like Kubevirt, Longhorn, Cillium and many more
-   MOWS APIs: Files, Authentication, Real-time, Notification, AI, Maps, Federation, Monitoring/Metrics and more
-   MOWS components for React to create frontend web apps with access to files or any other APIs with ease
-   Application Manager that automatically sets up reverse proxying, DNS configuration and access to the different APIs
-   Basic applications: Password manager, E-Mail Server and Frontend, video streaming, audio streaming, GitLab, calendar, contacts etc. all integrated well with each other

## Principles

### Web

-   Strong CSP, no unsafe inline
-   No external resources, never
-   Offline capable

### Containers

-   Small image sizes, best from scratch
-   Low resource consumption when idle

## Community Collaboration

Some of the MOWS APIs may require a greater computation effort to provide and keep up to date. The Maps API for example requires the OpenStreetMap database to be converted to tiles that then can be served to the applications. To create these tiles for the whole earth involves many computing hours that would be to computationally expensive for each user to calculate themselves and also a pretty big waste of resources as it would be completely redundant. This is where the Zero trust environment and the open ecosystem shines as the computation can be distributed to many machines and then shared with everyone. Other workloads like Machine learning could be distributed as well.

Encrypted backups could also be distributed across the machines of many users.

## Hardware Configuration Example

MOWS aims to be highly cost effective by restructuring and rebuilding a whole ecosystem from the ground up. The idea is to use 3 slower machines and "combine" them to create one bigger more reliable system that you can expand on or switch out parts of it on the go.

**THIS IS A THEORETICAL SETUP AND HAS NOT BEEN TESTED, BUILD AT YOUR OWN RISK**

As a basic example you could be building a 3 node cluster on the N100 platform using a NAS motherboard from alibaba like this: https://www.alibaba.com/product-detail/E-NAS-N100-DDR5-Motherboard-6_1601012049122.html

Doing some napkin math for this comes out to:

-   Motherboard + CPU: 110€
-   Pico PSU: 30€
-   Power Brick: 30€
-   16GB DDR5 Laptop RAM: 50€
-   1 TB NVME SSD: 70€

Totalling without spinning rust drives and case to 290€ per machine, amounting to 870€ for the whole base system. For that you get a very energy efficient, reasonably fast, highly reliable machine to power your services that can be expanded on by adding any other machine with or without crazy hardware specs.

Now you could connect up to 24 SATA hard drives, one more NVME SSD or an adapter for even more SATA ports.
You have 48GB of fast RAM at your disposal as well as 12 cores on the AMD64 architecture supporting virtualization as well as hardware acceleration for everything from video encoding/decoding to encryption while only consuming around 25W in total.
