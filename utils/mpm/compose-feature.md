# there should be a "mpm compose" command that does the following,

## render pipeline

- provide variables from mows-manifest.yaml to the template engine at "$chart.projectName" etc.
- provide variables from values.yaml to the template engine at ".abc.def" etc.

- files in results should all be deleted but "./results/generated-secrets.env" should be kept and not deleted

- The "./templates/generated-secrets.env" file should be rendered to "./results/generated-secrets.env", this file is for generated secrets like db passwords etc. this should be generated every time but making sure it does not overwrite existing keyValues in the target file if they are not empty,if they are empty they can be overwritten with new template render content

- copy the "./provided-secrets.env" file to "results/provided-secrets.env" overwrite existing
- render all templates from the folder "./templates/config" to "./results/config" every time
- render the "templates/docker-compose.yaml/yml" to "./results/docker-compose.yaml/yml" every time
- if labels in the docker compose file are present in a tree structure they need to be flattened in the target file after templating
- create a symlink for the maybe existing "./data" directory to "./results/data" if there is no data directory create it first and symlink then to "./results/data"
- the data directory should be chmod

- render the "./templates/admin-infos.yaml" file to "./admin-infos.yaml" here the variable "$generatedSecrets" and "$providedSecrets" in the template engine should be the content of the "./results/generated-secrets.env" and "./provided-secrets.env" respectively

- debug checks
    - when traefik labels are used, is a traefik container present on the system, does it have the same network as our deployment?
    - when ofelia or watchtower is used is there a handler present?
    - are all files that should get mounted through volumes present?
    - check file permissions in and outside container
    - verification that services are healthy after docker compose up is performed
        - fetching endpoints to verify e2e connectivity
        - check logs and container status and display them right away

## mpm compose up

- read mows-manifest.yaml/yml

```yaml
manifestVersion: "0.1"
metadata:
    name: live-public-transport
    description: ""
    version: "0.1"
spec:
```

- run render pipeline

- then run `docker compose -p PROJECT_NAME --project-directory results/ up --build -d --remove-orphans` should be run

## mpm compose install $URL

- install a mpm repo from a url cloning it to the current path without git history
- cd to the the first directory with a mows-manifest.yaml file in it
- write config file to `~/.config/mows.cloud/mpm.yaml`

```yaml
compose:
    projects:
        - projectName: live-public-transport
          instanceName: null
          repoPath: /home/paul/projects/trams/
          manifestPath: ./deployment/ # the mows-manifest.yaml is implied, the file would then be at /home/paul/projects/trams/deployment/mows-manifest.yaml
```

## mpm compose update

- update the repo over git, merge the new values.yaml file with the present values.yaml file so that the present keys overwrite the new "default" ones
- when the folder where the new mpm file is located was changed it needs to be searched again like in install
    - the current state: values.yaml generated and provided secrets need to be copied over to the new folder
    - the global config needs to be updated with the new path
- keys that aren't present anymore in the new file/version but that are still present in the present file should be commented out with a note that they aren't used anymore

## mpm compose \*

- other commands should also be passed on to docker compose but always with our context information depending where the docker compose command allows for these params
- `--project-directory results/`
- `-f results/docker-compose.yml/yaml`
- `-p PROJECT_NAME`
- `--env-file results/provided-secrets.env,results/generated-secrets.env`

## mpm compose cd $PROJECT_NAME

- navigate to the folder where the manifest of the project is located using the ~/.config/mows.cloud/mpm.yaml
- if there are multiple instances of a project provide the options to the user

## mpm compose secrets regenerate [KEY]

- should regenerate an explicit secret

## mpm compose init $NAME

- scaffold a mpm compose project
- if $NAME is given use it as project name, else get the name of the current git repo and use it as project name
- create a deployment folder for everything
- create `deployment/mows-manifest.yaml` file with the project name and basic structure with placeholders
- create `deployment/templates` folder
- create `deployment/values.yaml` file
- create `deployment/templates/docker-compose.yaml` file
- create `deployment/provided-secrets.env` file
- create `deployment/templates/generated-secrets.env` file
- create `deployment/data` folder
- create `deployment/results` folder
- create `deployment/templates/config` folder

- create `deployment/.gitignore` with

```.gitignore
admin-infos.yaml
results
```

### check the repository structure and fill the values/compose files accordingly

- search for dockerfiles
- add services to the docker compose file with the name of the the dockerfiles parent folder

For example

We are here:
`$GIT_ROOT/`

These files exist
`$GIT_ROOT/server/Dockerfile`
`$GIT_ROOT/web/Dockerfile`

```yaml
# `deployment/templates/docker-compose.yaml`
services:
    server:
        {{- if eq .services.server.build.enabled true }}
        build:
            context: "{{ .services.server.build.context }}"
            dockerfile: "{{ .services.server.build.dockerfile }}"
        {{- else }}
        image: "{{ .services.server.image }}"
        {{- end }}
        restart: unless-stopped


    web:
        {{- if eq .services.web.build.enabled true }}
        build:
            context: "{{ .services.web.build.context }}"
            dockerfile: "{{ .services.web.build.dockerfile }}"
        {{- else }}
        image: "{{ .services.web.image }}"
        {{- end }}
        restart: unless-stopped
```

```yaml
# `deployment/values.yaml`
services:
    server:
        build:
            enabled: true
            context: ../server/
            dockerfile: Dockerfile
    web:
        build:
            enabled: true
            context: ../web/
            dockerfile: Dockerfile
```

# Tasks

- Implement the features
- avoid code duplication
- write rust tests where possible
- split up the code into files in a sensible manor
- Write end to end tests for every feature that run in a docker container testing everything thoroughly
