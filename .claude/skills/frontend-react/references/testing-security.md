# Testing, Quality, Security, and Documentation Reference

Load this file for tests, quality commands, security, environment variables, dependency risk, documentation, and release readiness.

## Testing Standards

Use:

```txt
Vitest + React Testing Library + jsdom + jest-dom
```

Jest may be used in existing projects that already use Jest.

Rules:

1. Add or update tests for changed behavior.
2. Put mocks next to tests unless the project has a shared mock convention.
3. Cover main user interactions.
4. Cover loading, error, empty, and success states.
5. Cover accessibility expectations where relevant.
6. Avoid snapshots unless they provide clear value.
7. Do not remove tests to make the suite pass.
8. Do not ignore failing tests.
9. Test desktop manual pagination for table-heavy pages.
10. Test mobile infinite/on-scroll pagination for card-list views.
11. Test URL query persistence for search, filters, sorting, and pagination when relevant.

Required test types when applicable:

- unit tests
- integration tests
- accessibility tests
- E2E tests
- visual regression tests

For most feature work, at minimum add unit or integration coverage with React Testing Library.

## Quality Commands

Use npm commands by default.

Inspect `package.json` before running commands.

Common commands to run or recommend when available:

```bash
npm run format
npm run test
npm run build
npm run typecheck
npm run lint
```

Notes:

- The team uses Prettier.
- ESLint is not assumed unless present in the project.
- Husky, lint-staged, and commitlint are not assumed unless present.
- TypeScript checks apply only when the project uses TypeScript.

## Security Rules

1. Do not hardcode secrets, tokens, or environment-specific values.
2. Use `VITE_API_BASE_URL` for API base URLs.
3. Do not expose private environment variables in frontend code.
4. Avoid `dangerouslySetInnerHTML`; sanitize and document if unavoidable.
5. Escape or sanitize user-generated content before rendering.
6. Do not store tokens in localStorage unless the existing architecture already requires it.
7. Justify new dependencies, especially auth, parsing, rendering, icon, and rich text packages.
8. Handle API errors safely without leaking sensitive backend details.
9. Respect RBAC in routes and UI actions.

## Documentation Rules

1. Update the generic README when project setup, architecture, or conventions change.
2. Include usage examples for reusable components or modules.
3. Use minimal comments.
4. Add JSDoc for complex hooks, services, and non-obvious business logic.
5. Do not comment obvious code.
6. Document assumptions and tradeoffs in final responses.