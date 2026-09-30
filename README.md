# SchoolManagment.Web

React frontend for `SchoolManagment.API`. See `../FRONTEND_PLAN.md` for the full
architecture and module roadmap.

React 19 · TypeScript 7 · Vite 8 · Redux Toolkit + RTK Query · MUI 9 · React Router 7

## Running it

The API must be running first — the dev server proxies `/api` to it.

```bash
# once, so the proxy can trust the ASP.NET dev certificate
dotnet dev-certs https --trust

# terminal 1 — the API on https://localhost:7180
cd ../SchoolManagment.API && dotnet run --launch-profile https

# terminal 2 — the frontend on http://localhost:5173
npm install
npm run dev
```

| Script | Does |
|---|---|
| `npm run dev` | Dev server with HMR at http://localhost:5173 |
| `npm run build` | `tsc -b` then a production build into `dist/` |
| `npm run lint` | oxlint |
| `npx tsc -b` | Type-check only |

## Layout

```
src/
  app/          store, typed hooks, baseApi (envelope unwrap + token refresh), cache tags
  types/        mirrors of Models/Common and Constants.cs
  features/     one folder per module: types · api · slice · pages · components
  components/   layout (shell, sidebar, topbar), feedback, form, data
  ui/           theme, snackbar queue
  routes/       route manifest, lazy per module
  lib/          server-error mapping
```

## Three things to know before adding a module

**1. Responses are already unwrapped.** `app/baseApi.ts` strips the
`ApiResponse<T>` envelope, so a query's `data` is the payload. A `{ success: false }`
body arriving with HTTP 200 is converted into an RTK Query error, so components have
one failure path. Do not add `transformResponse` for this.

**2. Permissions default to deny.** Gate UI with `<Can module="Fees" action="Create">`
or `useCan('Fees', 'Create')`, and routes with `<RequirePermission module="Fees">`. A
module absent from the login grid is denied — same rule as the server. Add the module
to `components/layout/navConfig.ts` and the sidebar picks it up automatically.

Where a controller gates on the role name instead of the grid, guard on both.
`RolesController` is `[Authorize(Roles="SuperAdmin")]` at class level, so it needs
`<RequireRole roles={[ROLES.SuperAdmin]}>` as well.

**3. Server validation maps to form fields.** In a mutation's `catch`, call
`applyServerErrors(error, setError, FIELDS)`; it routes `errors[{field, message}]` onto
the matching inputs and returns whatever it could not place, for form-level display.

## Not yet implemented server-side

`Schools`, `Settings` and `Reports` are permission modules with no controllers, so they
are deliberately absent from the sidebar. The most consequential is `Schools`:
SuperAdmin's `SchoolId` is `null` and there is no endpoint to list or switch schools,
so platform administration cannot be built yet. Details in `../FRONTEND_PLAN.md` §7.
