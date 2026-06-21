# Architecture Reference

Load this file for import rules, module boundaries, architecture decisions, components, pages, state, API/service layer, forms, routing, authentication, and RBAC.

## Import Direction Rules

Enforce one-way imports as a strong guideline, not a locked vault. Break the rule only when the existing app already does so or the user explicitly asks.

Preferred dependency flow:

```txt
app -> routes -> pages -> components/hooks/services/api/context/config/types/utils
```

Rules:

1. A feature/page must not import private internals from another feature/page.
2. Feature/page folders may import from shared folders.
3. Shared folders must not import from feature/page folders.
4. Use public `index.js` barrel exports at folder boundaries.
5. Create barrel exports for shared folders and major modules.
6. Avoid deep imports across module boundaries.
7. Keep circular dependencies out of the codebase.

Good:

```js
import { getProducts } from "@/api";
import { ROUTE_KEYS } from "@/config";
import { AppButton, AppCard } from "@/components/shared";
```

Avoid:

```js
import AppButton from "@/components/shared/AppButton/AppButton";
import { somePrivateHelper } from "@/pages/productCatalog/hooks/useProductFilters";
```

## Page and Module Rules

Pages are containers. They may coordinate hooks, route params, query state, services, and presentational components.

A page module may contain:

```txt
pages/
  productCatalog/
    ProductCatalogPage.jsx
    actions.js
```

Use `actions.js` inside the same module folder for page-specific workflow functions that coordinate hooks, services, and side effects — flows such as submit, delete, export, bulk update, or wizard transitions.

Do not move module-specific behavior into global utilities unless it is genuinely reusable across modules.

Do not import another module's private hooks, private helpers, or internal components. If cross-module reuse is needed, promote the code to a shared area or expose it through a public module export.

## Existing Architecture Rule

For existing projects, follow the current structure first. Apply this architecture gradually only to touched files unless the user requests migration.

## Component Rules

1. Use arrow functions for React components.
2. Prefer small single-file components for simple UI.
3. Do not force every component into its own folder.
4. Keep reusable shared components in `src/components/shared/`.
5. Keep feature-specific components inside the page/module folder when they are not reusable.
6. Keep components below 300 lines at all costs.
7. Extract repeated UI into smaller components or configuration maps.
8. Keep business logic out of presentational components.
9. Do not fetch data directly inside components. Fetch in hooks, API modules, or services.
10. Use semantic HTML where possible.
11. Make responsive behavior explicit when the user asks for responsive requirements.
12. Support WCAG 2.1 AA accessibility expectations.

Simple component shape:

```jsx
const AppButton = ({ children, className = "", ...props }) => {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default AppButton;
```

Use default exports for components and modules unless the existing project uses named exports.

## State Management Rules

Use Context API for global app state.

Use global context for:

- `isAuthenticated`
- `user`
- `userRole`
- `isSidebarOpen`
- `availableLogins` when shared across login/auth screens
- app-wide layout state
- global auth/session state
- RBAC capability maps

Keep state local when it belongs to one component, page, or grid:

- `isEditModalOpen` for one page
- table pagination for one grid
- temporary form state
- selected row inside one table
- page-only filter state unless it must persist to URL or be shared

Use TanStack Query for server data, caching, retries, background refetching, and async state.

Do not put server data into global client state unless another component needs it and using the query cache is not enough.

Always handle loading, error, empty, and success states. Use Skeleton or appropriate Ant Design loading UI for loading states. Use client-facing fallback text and toast/snackbar for error states.

Optimistic updates are allowed when they improve UX and can be safely rolled back.

Use state machines for complex flows with many states, transitions, or branching journeys.

## API and Service Layer Rules

Use APISauce for backend calls.

Preferred API structure:

```txt
src/api/
  client.js
  auth.js
  products.js
  users.js
  endpoints.js
  index.js
```

`src/api/client.js` must centralize:

- base URL from `VITE_API_BASE_URL`
- auth headers
- request/response transforms when needed
- timeout defaults
- error normalization hooks when appropriate

Example shape:

```js
import { create } from "apisauce";

const apiClient = create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000,
});

apiClient.addRequestTransform((request) => {
  // Attach auth headers through the existing auth/session mechanism.
});

export default apiClient;
```

API modules should contain backend calls only.

```js
import apiClient from "./client";
import { ENDPOINTS } from "@/api";

const getProducts = (params) => apiClient.get(ENDPOINTS.PRODUCTS, params);
const updateProduct = (id, payload) => apiClient.put(`${ENDPOINTS.PRODUCTS}/${id}`, payload);

export default { getProducts, updateProduct };
```

Services should contain frontend business logic, DTO mapping, normalization, and domain helpers.

Keep backend DTO shapes separate from frontend view models where possible.

Even in JavaScript projects, document DTO expectations in `src/types/` using exported shape objects, comments, JSDoc, or future TypeScript-ready structures.

## Forms and Validation

Use Ant Design Form when Ant Design is part of the screen. Use Formik when Ant Design is not being used.

Use Ant Design validation rules or custom validation with Ant Design. Use Yup with Formik.

Rules:

1. Keep reusable validation rules in `src/validations/`.
2. Use controlled components.
3. Handle submit loading state.
4. Disable submit when appropriate.
5. Show field-level validation errors.
6. Show server errors clearly.
7. Use client-facing error messages, not raw backend traces.
8. Keep form labels visible and accessible.

## Routing and Layouts

Use React Router by default. Centralize routes in `src/routes/index.js`.

Required layout files for new apps:

```txt
src/layouts/DashboardLayout.jsx
src/layouts/AuthLayout.jsx
src/layouts/PublicLayout.jsx
```

Rules:

1. Use protected routes for authenticated areas.
2. Use route guards for auth and RBAC checks.
3. Use route-level code splitting for pages.
4. Add page titles, breadcrumbs, and metadata patterns when relevant.
5. Keep routes readable and centralized.
6. Use lowercase kebab-case for URL paths.

## Authentication and Authorization

Use JWT authentication by default. RBAC is expected.

Permission checks may live in hooks, route guards, components, and config. Use config-driven permissions where possible.

```js
export const PERMISSIONS = {
  PRODUCT_VIEW: "product.view",
  PRODUCT_ADD: "product.add",
  PRODUCT_EDIT: "product.edit",
  PRODUCT_DELETE: "product.delete",
};
```

Use frontend capability keys such as:

```js
const capabilities = {
  canView: true,
  canAdd: false,
  canEdit: true,
  canDelete: false,
};
```

Rules:

1. Hiding UI is not the same as blocking access.
2. Route guards must prevent unauthorized access.
3. Components may hide unavailable actions for UX.
4. Backend remains the final authority for authorization.
5. Support multi-tenant patterns only when requested.