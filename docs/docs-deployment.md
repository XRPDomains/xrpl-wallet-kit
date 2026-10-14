# Documentation deployment

Build documentation from a published, non-draft release tag independently of npm:

```sh
gh workflow run docs-release.yml -f release_tag=v0.1.22
```

By default this creates a `release-docs` artifact only. Enable `deploy_pages=true`
only when this repository's GitHub Pages destination is configured and intended.
The workflow does not change DNS or deploy to an arbitrary external host such as
xrpdomains.xyz. External hosting can consume the same artifact.
Builds use the release tag, not a moving branch. A new release must include the
Vue package and updated documentation before those additions appear in its site.
