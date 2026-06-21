# Templates and Examples Reference

Load this file for scaffolding, migration plans, review formats, implementation plans, and examples.

## New Project Scaffolding Rules

When asked to create a new frontend project, scaffold a complete base structure using the default stack.

Include:

- Vite React setup
- JavaScript by default
- Tailwind setup
- Ant Design setup
- APISauce client setup
- TanStack Query provider
- Context providers
- React Router centralized routing
- route-level lazy loading
- base layouts
- empty pages/modules structure
- shared components folder
- config folder
- api folder
- services folder
- validations folder
- test setup
- Prettier config
- path aliases

Do not include example feature modules unless the user asks. Keep the template empty and ready for real product code.

## Existing Project and Migration Strategy

When working in an existing project:

1. Follow the current structure first.
2. Do not force this architecture into the project unless requested.
3. If architecture migration is requested, produce a migration plan before changing files.
4. Move code feature-by-feature when touching related files.
5. Avoid large refactors unless explicitly requested.
6. Use compatibility wrappers when needed to preserve behavior.
7. Preserve public APIs and existing imports unless migration requires changes.
8. Keep behavior parity as the main success criterion.

Migration plan format:

```markdown
## Migration Plan

### Current Structure Observed

- [brief notes]

### Target Structure

- [brief notes]

### Safe Migration Steps

1. [small step]
2. [small step]
3. [small step]

### Compatibility Strategy

- [wrappers, aliases, transitional exports]

### Tests Required

- [coverage needed]

### Risks

- [known risks]
```

## Feature Implementation Template

Use this template for feature prompts and implementation plans:

```markdown
# [Feature Name]

## Goal

Implement [feature] while following the existing project patterns and Hazentech frontend architecture rules.

## Requirements

- [functional requirement]
- [functional requirement]
- Handle loading, error, empty, and success states.
- Preserve existing behavior and public APIs.
- Persist URL query state when filters/search/sort are route-relevant.
- Add or update tests for main interactions and edge cases.

## Architecture

- Page/container: `src/pages/[module]/[Module]Page.jsx`
- Components: `src/components/[module]/`
- Hooks: `src/hooks/[module]/`
- API calls: `src/api/[resource].js`
- Services: `src/services/[resource]Service.js`
- Validations: `src/validations/[resource]Validation.js`
- Types/shapes: `src/types/[resource]Types.js`

## Constraints

- Keep changes focused.
- Do not add dependencies unless necessary.
- Do not rewrite unrelated code.
- Keep every component under 300 lines.
- Use default exports.

## Tests

- Main happy path
- Loading state
- Empty state
- Error state
- URL query persistence
- Main user interactions
- Accessibility expectations
```

## Example Feature Standard

For a request like:

```txt
Generate a Product Catalog page with filters, sorting, and cart actions.
```

Claude should implement or plan:

```txt
src/
  pages/
    productCatalog/
      ProductCatalogPage.jsx
  components/
    productCatalog/
      ProductCatalogFilters.jsx
      ProductCatalogGrid.jsx
      ProductCard.jsx
      CartActionButton.jsx
      actions.js
      index.js
  hooks/
    useProductCatalog.js
    useProductCatalogQueryParams.js
  api/
    products.js
  services/
    productService.js
  types/
    productTypes.js
  validations/
    productValidation.js (if forms are involved)
```

Expected behavior:

- keyword search
- status/category filters when required
- sorting
- cart actions
- loading skeleton
- empty state
- error fallback with toast/snackbar
- URL query persistence for search, filters, sorting, and pagination when relevant
- desktop/tablet table view with manual pagination
- mobile card-list view with on-scroll or infinite-scroll pagination
- tests for main interactions and edge cases
- no unrelated rewrites

## Example Reusable Search and Filter Component Standard

For a request like:

```txt
Implement a reusable search and filter component for [resource/page] that supports keyword search, status filtering, empty/loading/error states, edge cases, URL query persistence, and tests covering the main interactions.
```

Claude should:

1. Inspect existing shared components, page filters, route/query utilities, and table patterns.
2. Reuse existing AppInput, AppButton, AppSelect, AppTable, Lucide React icons, or Ant Design components where available.
3. Keep the search/filter component presentational when possible.
4. Put state orchestration in a hook, such as `useResourceFilters`.
5. Use URL query persistence for route-relevant filters.
6. Debounce keyword search if existing utilities support it.
7. Handle reset/clear behavior.
8. Handle invalid query params safely.
9. Add tests for search, filter change, reset, URL persistence, desktop manual pagination, mobile infinite scroll, loading, empty, and error states.
10. Keep the component under 300 lines.

## Bad Output Example

This is bad and must be avoided:

```txt
The user asked to extract a large component into smaller components, but Claude rewrote the entire feature, changed libraries, altered behavior, removed tests, and introduced architecture changes that were not requested.
```

Why it is bad:

- Too broad
- Behavior changed without permission
- Dependencies or libraries changed without need
- Tests were removed
- Public contracts may have changed
- Architecture was changed without a migration plan

## Excellent Output Standard

Excellent Claude output is:

```txt
correct + constrained + clean + intentional
```

It should:

- solve the requested problem
- touch only necessary files
- follow existing patterns
- improve readability
- keep components small
- preserve behavior
- add or update tests
- document assumptions
- explain risks clearly
- leave the project easier to maintain than before
