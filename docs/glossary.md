# Glossary

## Project

A top-level folder that the [map](/AGENTS.md) lists as a project, or a [subproject](#subproject) of one. The [specification rules](/docs/conventions/specs.md) say when a project needs a specification.

## Subproject

A project inside another project, such as each game in `games/titles/` or each folder in `temp-sites/projects/`. The documentation of a project says which subprojects it has.

## Module

A part of a project, or of another module, that the documentation of the project names as a module, such as the transport module of the games platform.

## Deployment

A folder that a deploy workflow deploys on its own with its Compose file, `compose.yml` or `docker-compose.yml`, such as `www/` or `games/platform/signaling/`. A project can hold several deployments: in `games/`, each title, the index page, the signaling server in `platform/signaling/` and the TURN server in `platform/turn/` are deployments. File and variable names in code, such as `deploy-project.yml`, call a deployment a project. In `temp-sites/`, each subproject is one deployment, and `traefik/` is one more.

## Integration test

A unit test checks one function, class, file or component on its own. An integration test checks how several of them work together, such as a game's rules with the platform's room functions. Either kind runs in Node or in a real browser, as the [testing rules](/docs/conventions/tests.md) say.

## Document

A Markdown file of the repository, other than a post of the blog in `blog/src/posts/`, which is a page of the site.
