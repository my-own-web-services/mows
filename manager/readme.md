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
