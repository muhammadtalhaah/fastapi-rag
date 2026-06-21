# UI and Styling Reference

Load this file for Tailwind CSS, Ant Design, shadcn/ui, Lucide React icons, data display, responsive behavior, pagination, theming, accessibility, performance, and import ordering.

## Source of Truth Order

Before applying these rules, inspect the current repository for existing UI conventions.

Use this priority order:

1. Existing repository conventions and configured tooling.
2. Company design-system components, tokens, and wrappers.
3. Ant Design component APIs and theme tokens.
4. Tailwind utility classes for layout and small presentation adjustments.
5. This reference file when the repo has no clearer rule.

Do not override established repo conventions only to satisfy this document. When a repo convention conflicts with this reference, follow the repo and mention the difference in the final response if it affects the implementation.

## Styling and UI Ownership

Use Tailwind CSS for:

- page and section layout
- flexbox wrappers
- spacing and alignment
- responsive visibility and layout changes
- typography utilities when no design-system typography component exists
- simple state styling for custom lightweight elements

Use Ant Design for mature UI primitives:

- forms
- tables
- modals
- drawers
- selects
- date pickers
- tabs
- tooltips
- popovers
- tags
- alerts
- skeletons
- empty states
- notifications
- pagination controls

Use shadcn/ui only when the project already uses it or the user explicitly asks for it. Do not mix shadcn/ui and Ant Design for the same primitive in one feature unless the existing project already has that pattern.

Prefer company design-system components when available. Treat shared/company components as the ownership layer for repeated UI decisions. Do not bypass them with raw Ant Design or raw HTML unless the shared component cannot support the required behavior.

## Tailwind and Ant Design Boundary

Use Tailwind around Ant Design components for layout. Let Ant Design own the internals of its components.

Good uses of Tailwind with Ant Design:

- wrapping `Form`, `Table`, `Card`, or `Modal` sections
- spacing between controls
- responsive parent layouts
- width constraints
- grid/flex layout
- page padding and section gaps

Avoid these patterns unless the existing repo already uses them:

- deeply targeting Ant Design internals with custom CSS selectors
- forcing Ant Design component internals through long Tailwind class strings
- replacing Ant Design form/table behavior with custom code without a clear need
- styling by fragile generated class names
- mixing Ant Design status colors with unrelated hardcoded Tailwind colors

When Ant Design customization is needed, prefer this order:

1. Existing company component props.
2. Ant Design component props.
3. Ant Design theme tokens or `ConfigProvider` theme configuration.
4. Small wrapper classes for layout-only concerns.
5. Scoped CSS only when the prior options cannot solve the requirement.

## Design Tokens and Theming

Use design tokens when available. Tokens should own recurring decisions for color, spacing, radius, typography, elevation, and status styles.

Rules:

1. Check for existing token files, theme config, CSS variables, Tailwind config, or Ant Design `ConfigProvider` setup before adding styles.
2. Do not hardcode brand colors, status colors, shadows, or spacing scales when tokens exist.
3. Keep color usage semantic, such as success, warning, danger, muted, surface, border, and text.
4. Do not introduce a new token naming scheme inside a feature.
5. If a token is missing, use the nearest existing semantic token and document the assumption.
6. Keep Ant Design theme tokens and Tailwind theme values aligned when touching global theme setup.


### Tailwind Theme Defaults

When creating a new project or when the repo has no existing breakpoint/token strategy, use these Tailwind theme defaults. If the repo already defines different screens or color tokens, preserve the repo configuration first and do not rewrite it only to match this file.

```js
// tailwind.config.js
export default {
  theme: {
    extend: {
      screens: {
        sm_mobile: "300px",
        md_mobile: "350px",
        lg_mobile: "420px",
        sm_tablet: "600px",
        md_tablet: "750px",
        lg_tablet: "992px",
        sm_desktop: "1206px",
        md_desktop: "1350px",
        xm_desktop: "1500px",
        lg_desktop: "1900px",
        xl_desktop: "2100px",
      },
      colors: {
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        secondary: "rgb(var(--color-secondary) / <alpha-value>)",
      },
    },
  },
};
```

Use these custom breakpoints semantically:

- `sm_mobile`, `md_mobile`, `lg_mobile`: phone-specific layout refinements.
- `sm_tablet`, `md_tablet`, `lg_tablet`: tablet and compact dashboard layouts.
- `sm_desktop`, `md_desktop`, `xm_desktop`: standard desktop dashboards and data-heavy pages.
- `lg_desktop`, `xl_desktop`: wide-screen layout polish only; do not hide core functionality behind ultra-wide breakpoints.

Define the matching CSS variables at the application theme/root layer when using `primary` and `secondary` colors:

```css
:root {
  --color-primary: 0 0 0;
  --color-secondary: 0 0 0;
}
```

Replace the placeholder RGB triplets with the actual Hazentech/project design-token values. Do not hardcode `text-primary`, `bg-primary`, `border-primary`, `text-secondary`, `bg-secondary`, or `border-secondary` colors outside the token system.

### Dark Mode

Do not add dark mode unless the project already supports it or the user requests it.

If dark mode exists:

1. Preserve the existing strategy, such as class-based Tailwind dark mode, CSS variables, Ant Design algorithm tokens, or a custom theme provider.
2. Do not hardcode light-only colors.
3. Test text, borders, disabled states, empty states, skeletons, dropdowns, modals, and table rows in dark mode where relevant.
4. Keep icons visible in both themes.
5. Do not create a second theme system.

## Lucide React Icons

Use Lucide React for standard icons. Prefer Lucide icons over ad-hoc SVGs, emoji icons, image icons, or adding another icon package.

Rules:

1. Import only the icons needed by the file.
2. Keep icon size, stroke width, color, labels, and button alignment consistent with surrounding UI.
3. Decorative icons must use `aria-hidden="true"` or be inside elements that already have accessible text.
4. Meaningful icon-only buttons must have an accessible label, such as `aria-label="Search"`.
5. Do not add another icon library unless explicitly requested or required by the existing design system.
6. Preserve the existing icon system when working in a repo that already standardized on another library.

Example:

```jsx
import { Search } from "lucide-react";

const SearchButton = ({ onClick }) => {
  return (
    <button type="button" aria-label="Search" onClick={onClick}>
      <Search aria-hidden="true" size={18} />
    </button>
  );
};

export default SearchButton;
```

## Responsive Behavior

Follow the repository's existing breakpoint strategy first. If none exists, use the Hazentech custom Tailwind screens from the Tailwind Theme Defaults section:

- mobile: `sm_mobile`, `md_mobile`, `lg_mobile`
- tablet: `sm_tablet`, `md_tablet`, `lg_tablet`
- desktop: `sm_desktop`, `md_desktop`, `xm_desktop`
- wide desktop: `lg_desktop`, `xl_desktop`

Use Tailwind's default `sm`, `md`, `lg`, `xl`, and `2xl` breakpoints only when the existing repo already relies on them or the custom screens are not configured.

Rules:

1. Build mobile-first layouts, then enhance for tablet and desktop.
2. Use layout wrapper components with flexbox or grid for responsive parent layouts.
3. Keep page-level spacing consistent with existing layouts.
4. Do not hide essential actions on mobile.
5. Move secondary actions into menus only when the UX remains discoverable.
6. Preserve keyboard access and readable focus order across breakpoints.
7. When requirements mention responsiveness, implement and test mobile, tablet, and desktop behavior.

## Data Display Rules

For data-heavy pages, use a responsive desktop/tablet table plus mobile card-list pattern.

Desktop and tablet:

1. Display structured datasets with Ant Design `Table` or the existing company table component.
2. Use manual/server-driven pagination.
3. Keep pagination state controlled.
4. Make pagination route-aware when filters, search, or sorting should survive refresh/share links.
5. Back pagination, filters, search, and sorting with API query params.
6. Do not fetch all records and paginate only in memory for large or server-backed datasets.
7. Use stable row IDs through `rowKey`.
8. Preserve loading, empty, error, and success states.

Mobile:

1. Replace dense tables with a readable card list.
2. Do not squeeze full tables into tiny horizontal-scroll layouts unless the existing design explicitly requires it.
3. Use on-scroll or infinite-scroll pagination.
4. Load the next page when the user approaches the end of the list.
5. Guard next-page loading with a `hasNextPage` / `isFetchingNextPage` style flow.
6. Show the most important fields first.
7. Include clear actions.
8. Preserve loading, empty, error, and end-of-list states.
9. Use stable IDs for cards and actions.
10. Keep card spacing, tap targets, and action labels accessible.

Shared data rules:

1. Keep desktop pagination and mobile infinite scroll backed by the same API contract whenever possible.
2. Avoid duplicate data-fetching logic between table and card views.
3. Keep filters, sorting, search, and URL query persistence consistent across desktop and mobile views.
4. Keep selection, bulk actions, and row/card actions behaviorally equivalent unless the UX explicitly differs.
5. Use Skeleton loading for initial loading and lightweight incremental loading indicators for mobile next-page fetches.

## Accessibility Checklist

Apply these checks to new or changed UI:

1. Use semantic HTML before ARIA.
2. Every input has a visible label or an accessible name.
3. Every icon-only button has an `aria-label`.
4. Decorative icons are hidden from assistive technology.
5. Interactive elements are reachable and usable by keyboard.
6. Focus states are visible.
7. Modal and drawer interactions preserve focus behavior and close affordances.
8. Error messages are visible, understandable, and associated with the relevant field or region where practical.
9. Do not use color alone to communicate status.
10. Text and important UI states meet WCAG 2.1 AA contrast expectations.
11. Loading, empty, error, and success states are announced or discoverable where relevant.
12. Tables have meaningful column labels and actions.
13. Mobile cards expose the same essential information and actions as desktop tables.

## Import Ordering

Follow the existing repository import-ordering convention first, including ESLint, Prettier plugins, or established file patterns.

If the repository has no clear convention, use the team's hill-like rule and keep imports ordered from closest to farthest:

1. Same-folder relative imports.
2. Nearby module imports.
3. App alias imports, such as `@/components`.
4. External packages.
5. Side-effect imports and styles last.

Do not reorder imports across an existing file only for style unless the task already touches that file and the change is low-noise.

Example:

```js
import ProductFilters from "./components/ProductFilters";
import useProductCatalog from "./hooks/useProductCatalog";
import { ROUTE_KEYS } from "@/config";
import { AppButton } from "@/components/shared";
import { Table } from "antd";
import { Search } from "lucide-react";
import "./productCatalog.css";
```

## Performance Rules

1. Avoid heavy dependencies unless necessary and approved.
2. Use route-level lazy loading for pages.
3. Use memoization where it prevents avoidable re-renders or stabilizes expensive derived values.
4. Do not add memoization that makes code harder to understand without a clear reason.
5. Use virtualization for large lists after a reasonable size threshold or when performance degrades.
6. Optimize images with appropriate formats, dimensions, lazy loading, width/height, and alt text.
7. Prefer pagination, filtering, and server-side querying for large datasets.
8. Avoid repeated data transformations inside render for large collections.
9. Keep table column definitions stable when they cause avoidable re-renders.
10. Use responsive image and asset loading patterns when available in the project.