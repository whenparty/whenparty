# Working on workflow files

## Pinning actions

Every action from another repository, GitHub's own included, is pinned to a full commit SHA with its version in a comment:

```yaml
uses: owner/action@<sha> # v1.2.3
```

A tag can be moved to other code, but a SHA cannot, and the deploy jobs hold the VPS SSH key. To update an action, look up the commit of the new release tag and replace both the SHA and the comment.

## Permissions of reusable workflows

A reusable workflow gets only the permissions and secrets its caller passes. A caller of `deploy-project.yml` must grant `contents: read` and `packages: write`, and a caller of `site.yml` must also grant `security-events: write`. Both pass `secrets: inherit`, because the deploys log in to the VPS with the repository secrets. The checks keep their tokens read-only, as [checks.md](/.github/docs/checks.md) says.

## Trying a change

The repository has no local check of workflow files.

- A pull request runs `ci.yml` and the checks it calls from the pull request's own branch.
- A deploy workflow runs only from `main`. The exceptions are `games.yml` and `traefik.yml`: running one by hand on a branch deploys that branch.
- Merging a change to a deploy workflow, or to `deploy-project.yml` or `site.yml`, runs the workflows that list it in `paths`. [deploys.md](/.github/docs/deploys.md) says which of them then deploy.
