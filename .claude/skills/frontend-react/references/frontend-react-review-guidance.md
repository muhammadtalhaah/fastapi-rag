# Frontend React Review Guidance

Use this outside the `frontend-react` implementation skill when the task is a standalone frontend code review.

## Review Scope

Review React, JavaScript, Tailwind CSS, Ant Design, APISauce, TanStack Query, Context API, routing, forms, accessibility, performance, testing, and frontend security.

Do not rewrite the feature unless the user asks for implementation changes. Produce actionable findings.

## Review Format

```markdown
## Overall Assessment

[brief summary]

## P1 Must Fix

- [bug, security issue, broken behavior, data loss, failing test risk]

## P2 Should Fix

- [maintainability, accessibility, performance, fragile architecture]

## P3 Nice to Improve

- [naming, polish, minor simplification]

## Security Notes

- [security concerns if any]

## Suggested Fixes

- [specific changes or snippets]

## Pre-Merge Checklist

- [ ] Tests updated
- [ ] Loading/error/empty states handled
- [ ] Accessibility checked
- [ ] No unrelated rewrites
- [ ] No new dependencies without justification
```

## Review Checklist

- Components stay focused and under 300 lines.
- API calls do not live directly inside presentational components.
- Server state uses TanStack Query where appropriate.
- Global state is limited to genuine app-wide concerns.
- Ant Design tables use stable row keys and manual/server-driven pagination for data-heavy views.
- Mobile data views use card lists with guarded infinite scroll where applicable.
- Tailwind usage is readable and responsive.
- Lucide React is used for standard icons unless the project has a preserved icon system.
- Loading, error, empty, and success states are handled.
- User input is sanitized or escaped where needed.
- RBAC is enforced through route guards and UI capabilities.
- Tests cover changed behavior and main interactions.

Reviews must explain what to change and why. Do not only say something is bad.