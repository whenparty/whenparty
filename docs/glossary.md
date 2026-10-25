# Glossary

## Project

A top-level folder that the [map](/AGENTS.md) lists as a project, or a [subproject](#subproject) of one. The [specification rules](/docs/conventions/specs.md) say when a project needs a specification.

## Subproject

A project inside another project, such as each game in `games/titles/` or each folder in `temp-sites/projects/`. The documentation of a project says which subprojects it has.

## Module

A part of a project that the documentation of the project names as a module. Its boundary is what other modules rely on, such as the signaling protocol or the format of TURN credentials.

## Deployment

A folder that CI deploys on its own with its Compose file, `compose.yml` or `docker-compose.yml`, such as `www/` or `games/platform/signaling/`. A project can hold several deployments: in `games/`, each title and the signaling and turn modules are deployments, while p2p ships inside the games. File and variable names in code, such as `deploy-project.yml`, call a deployment a project. In `temp-sites/`, each subproject is one deployment, and `traefik/` is one more.
