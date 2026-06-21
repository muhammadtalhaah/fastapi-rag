# Frontend React Skill

## Purpose

Use this skill as the company-level frontend instruction set for Claude when working on Hazentech Software Development React applications.

**Trigger this skill for:** new features, bug fixes, refactors, code reviews, scaffolding, test updates, and migrations using Vite + React + Tailwind + Ant Design + APISauce + TanStack Query. Apply even for partial tasks like "add a filter", "fix this component", or "review this hook".

This guidance applies to all frontend work unless the user explicitly gives different instructions. It covers new React applications, existing project changes, code reviews, refactors, test updates, migration plans, and implementation planning.

Claude must optimize for consistency, maintainability, focused changes, readable architecture, and predictable project structure. Do not chase cleverness. Build software that a teammate can understand without archaeological equipment.

## Core Operating Principles

Claude must always follow these principles unless the user explicitly overrides them:

1. Keep changes minimal and focused.
2. Follow existing project patterns before introducing new ones.
3. Preserve backward compatibility.
4. Do not introduce new dependencies unless necessary and justified.
5. Add or update tests for changed behavior.
6. Run or clearly recommend relevant lint, format, typecheck, build, and test commands when applicable.
7. Do not make assumptions silently. Document assumptions in the final response.
8. Do not change public APIs unless explicitly required.
9. Prefer simple, clean, manageable code over clever abstractions.
10. Avoid unnecessary architecture churn.

When working in an existing project, inspect the current structure first. If the project differs from this standard, preserve the current structure unless the task is specifically about migration or standardization.

## Default Technology Stack

For new projects, assume this stack unless the user says otherwise:

```txt
Vite + React 19 or latest stable React + JavaScript + Tailwind CSS + Ant Design + APISauce + TanStack Query + Context API + React Router + Lucide React + Vitest + React Testing Library + jsdom + jest-dom
```

Use TypeScript or `.tsx` only when the user asks for it or the existing project already uses it.

### Defaults

- Framework: React with Vite
- Language: JavaScript first, TypeScript-ready where useful
- Package manager: npm
- State management: Context API
- Server state and data-fetching cache: TanStack Query
- API client: APISauce
- Styling: Tailwind CSS, plain CSS where appropriate
- UI libraries: Ant Design, shadcn/ui when already used or explicitly requested
- Icons: Lucide React
- Router: React Router by default, TanStack Router only when requested
- Forms: Ant Design Form when using Ant Design, otherwise Formik
- Validation: Ant Design Form validation or custom validation when using Ant Design, otherwise Yup
- Authentication: JWT
- Authorization: RBAC
- Environment variable for API base URL: `VITE_API_BASE_URL`

## Strict Never Rules

Claude must never do these unless explicitly instructed by the user:

1. Do not rewrite unrelated code.
2. Do not duplicate code across the application.
3. Do not remove existing functionality.
4. Do not ignore failing tests.
5. Do not hardcode secrets, tokens, credentials, or environment-specific values.
6. Do not change public APIs without explicit need.
7. Do not introduce new libraries for problems already solvable with existing project tools.
8. Do not move files into a new architecture without a migration plan.
9. Do not put API calls directly inside components.
10. Do not create large components above 300 lines.
11. Do not hide errors silently.
12. Do not use `dangerouslySetInnerHTML` unless explicitly approved and sanitized.
13. Do not store tokens in localStorage unless the existing app already does and the task is not about auth security.
14. Do not put secrets in frontend code, committed config, or `.env` examples.
15. Do not use array index as a React key when stable IDs exist.
16. Do not scatter helper functions or API calls randomly across the codebase.

## Claude Workflow

Before editing code, Claude must:

1. Identify the task type: new feature, bug fix, refactor, code review, scaffolding, test update, or migration.
2. Inspect relevant existing files, folder structure, aliases, dependencies, naming, and tests.
3. State a short plan before making changes when the task touches multiple files or architecture.
4. List the files it expects to touch when possible.
5. Ask clarifying questions only when missing information would materially change the implementation.
6. If proceeding with assumptions, document them clearly.
7. Keep the first change small enough to review safely.

After editing code, Claude must respond with:

```markdown
## Summary

- What changed
- Why it changed

## Files Changed

- `path/to/file` - reason

## Tests and Checks

- [command] - pass/fail/not run with reason

## Assumptions

- Any assumptions made

## Risks or Follow-ups

- Any remaining risks or recommended next steps
```

## Progressive Reference Loading

Use this `SKILL.md` first. Load reference files only when the task needs those details:

| Reference | Load when |
| --- | --- |
| `references/architecture.md` | Import direction, module boundaries, architecture decisions, components, pages, state, API/service layer, forms, routing, auth, RBAC. |
| `references/ui-styling.md` | Tailwind, Ant Design, shadcn/ui, Lucide icons, data display, pagination, performance, imports. |
| `references/testing-security.md` | Tests, quality commands, security, environment variables, docs, release readiness. |
| `references/templates.md` | Scaffolding, migration plans, review output, feature plans, examples. |

## Required New Project Structure

For new projects, scaffold this modular structure:

```txt
src/
  App.jsx
  main.jsx
  index.css
  assets/
    icons/
    imgs/
  components/
    shared/
      AppButton.jsx
      AppInput.jsx
      AppTable.jsx
      index.js
  config/
    routes.js
    constants.js
    permissions.js
  context/
    AuthContext.jsx
    LayoutContext.jsx
    index.js
  language/
    applicationLanguage.js
    index.js
  hooks/
    useDebounce.js
    useDisclosure.js
    index.js
  layouts/
    AuthLayout.jsx
    DashboardLayout.jsx
    PublicLayout.jsx
    index.js
  pages/
    auth/
      LoginPage.jsx
      index.js
    dashboard/
      DashboardPage.jsx
      index.js
    productCatalog/
      ProductCatalogPage.jsx
      components/
      hooks/
      actions.js
      index.js
  navigations/
    MainNavigator.jsx
    AuthNavigator.jsx
  api/
    client.js
    auth.js
    products.js
    endpoints.js
    index.js
  services/
    authService.js
    productService.js
    index.js
  styles/
    global.css
  types/
    authTypes.js
    productTypes.js
    apiTypes.js
    index.js
  utils/
    formatDate.js
    buildQueryString.js
    index.js
  validations/
    authValidation.js
    productValidation.js
    index.js
  test/
    setup.js
```

## Architecture Responsibilities

| Area | Responsibility |
| --- | --- |
| `src/routes/` | Centralized route definitions and route guards |
| `src/pages/` | Page-level containers, feature pages, route-level screens |
| `src/components/` | Presentational and reusable UI components |
| `src/hooks/` | Reusable hooks or feature-local state/workflow logic |
| `src/api/` | APISauce clients and backend API calls |
| `src/services/` | Frontend domain/business services and data shaping |
| `src/context/` | Global app state providers |
| `src/layouts/` | Dashboard, auth, and public layout shells |
| `src/config/` | Constants, route keys, permission keys, endpoint constants, app config |
| `src/types/` | Shared DTO/type-shape definitions, JS-friendly and TypeScript-ready |
| `src/validations/` | Shared validation rules and schemas |
| `src/utils/` | Generic pure utilities only |
| `src/navigations/` | App navigator composition such as MainNavigator, AuthNavigator and/or AdminNavigator |
| `src/language/` | Application localization, language exports, translation setup, and language configuration |

Wrap async data-fetching page sections in an error boundary. Use a shared ErrorBoundary fallback; do not let unhandled render errors crash the full app.

## Naming Summary

- Components, pages, contexts, providers: `PascalCase` files and symbols.
- Folders, functions, hooks, variables, API methods: `camelCase`.
- Hooks must start with `use`.
- JSON files use `snake_case.json`.
- Route, permission, feature, and endpoint constants use `UPPER_SNAKE_CASE`.
- Backend permission values use `feature.action`.
- Frontend capability keys use `canX`, such as `canView`, `canAdd`, `canEdit`, `canDelete`.
- Actual URL paths use lowercase kebab-case with `:id` params.
- Use default exports unless the existing project uses named exports.

## Required Cross-Cutting Rules

1. Use modular architecture for new projects.
2. Follow existing structure for existing projects unless the task is explicitly a migration.
3. Keep every component under 300 lines at all costs.
4. Use public `index.js` barrel exports at folder and module boundaries.
5. Fetch data in hooks, API modules, or services, never directly inside presentational components.
6. Use TanStack Query for server data and async cache behavior.
7. Use Context API only for genuinely global state.
8. Use Ant Design tables or the company table component on desktop and tablet.
9. Use mobile card lists with on-scroll/infinite-scroll pagination on small screens.
10. Use Lucide React for standard icons.
11. Persist route-relevant search, filters, sorting, and pagination in URL query params.
12. Cover loading, error, empty, and success states.
13. Add or update tests for changed behavior.
14. Document assumptions and risks in the final response.

## Existing Project Behavior

When working inside an existing codebase:

1. Inspect current folders, aliases, dependencies, naming conventions, and testing setup before coding.
2. Prefer the current project pattern over this standard when they differ and the user did not ask for migration.
3. Apply this standard gradually to touched code only.
4. Do not force broad folder moves, dependency swaps, or style rewrites.
5. Preserve public APIs, route contracts, imports, and behavior unless a change is explicitly required.

## New Project Behavior

When creating a new frontend app:

1. Scaffold Vite + React with JavaScript by default.
2. Include Tailwind, Ant Design, APISauce, TanStack Query, Context API, React Router, Lucide React, Vitest, React Testing Library, jsdom, jest-dom, Prettier, and path aliases.
3. Use the modular structure above.
4. Keep the template empty and ready for product code.
5. Do not include example feature modules unless the user asks.

## Code Review Behavior

When reviewing code:

1. Use P1, P2, and P3 severity labels.
2. Include security notes when relevant.
3. Make every finding actionable.
4. Explain what to change and why.
5. Do not rewrite everything unless a rewrite is clearly necessary and requested.
6. Use the review format in `references/templates.md`.

## Final Checklist

Before making a change, ask:

1. Is this change directly required?
2. Does it follow the existing project pattern?
3. Will this preserve current behavior?
4. Is there a smaller safer change?
5. Are tests needed or updated?
6. Did I document assumptions?
7. Did I avoid creating another giant component?

If the answer is no, stop and adjust the plan.
