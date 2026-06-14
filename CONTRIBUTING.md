# Contributing Guidelines

Thank you for contributing to our Angular Libraries monorepo! To help us keep the workspace clean, maintainable, and easy to parse, we follow a structured contribution workflow.

## Git Commit Rules

We follow **Conventional Commits with Scopes** (our recommended style) to make it highly distinguishable which package or project a change belongs to.

### Format

Commit messages must follow this structure:

```
<type>(<project>): <description>
```

- **Type**: Must be one of `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, or `revert`.
- **Project Scope**: The workspace project being modified. Allowed values are:
  - `web` — Common directives/signals for the web
  - `dialog` — Dialog library
  - `event-bus` — Event bus library
  - `store` — Monorepo store package
  - `translate` — Translation core package
  - `demo` — The demo testing application
  - `repo` — Root-level changes (e.g. workspace dependencies or config)
- **Description**: A short, imperative-present description of the change.

### Examples

- `feat(web): add JSDoc and example to click-outside directive`
- `fix(dialog): correct overlay focus trapping on escape key`
- `docs(translate): fix broken link in README`
- `test(store): add unit tests for sync messages`
- `chore(repo): update typescript to latest version`
