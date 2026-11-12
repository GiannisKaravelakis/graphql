# GraphQL Profile — Zone01 Athens

A profile page that signs in to the Zone01 platform and shows your school data, queried from its GraphQL API. Vanilla HTML/CSS/JS, hand-built SVG charts, no build step.

## Features

- **Login** with `username:password` or `email:password` (Basic auth, UTF-8 safe base64) and a specific error message for each failure case
- **Session** JWT kept in `sessionStorage`, so it survives a refresh. An expired or rejected token sends you back to the login page.
- **Logout** clears the token and every rendered piece of user data
- **Sections:** Identity, XP & Level, Audit ratio, Projects (in progress / recently finished), Skills
- **Statistics (SVG):**
  1. XP progression over time: animated line drawing, with a hover tooltip
  2. XP by project: interactive, with sorting (XP / recent / A–Z) and tooltips; keyboard-focusable
  3. Project PASS/FAIL donut: animated arcs with tooltips
  4. Bonus: skills radar chart

## Queries (for the audit)

All queries are in [`js/queries.js`](js/queries.js):

| Type | Where |
|---|---|
| Normal | `USER_QUERY`: `user { id login attrs … }` |
| Nested | `XP_QUERY` / `PROGRESS_QUERY`: `transaction { … object { name type } }` |
| With arguments | `XP_QUERY` / `PROGRESS_QUERY`: `where`, `order_by`, `limit` + variables (`$userId` comes from the JWT) |

## Project structure

```
index.html
css/style.css
js/config.js    endpoints + XP path filters
js/auth.js      sign-in, JWT decode, session
js/api.js       GraphQL fetch with Bearer token
js/queries.js   GraphQL queries
js/data.js      data shaping + formatting
js/charts.js    SVG charts
js/app.js       UI wiring
```

## Run locally

ES modules need an HTTP server (opening `index.html` as a file won't work):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository (files at the repo root).
2. Go to **Settings → Pages → Build and deployment** and set **Source** to "Deploy from a branch", **Branch** to `main` and `/ (root)`.
3. The site is published at `https://<username>.github.io/<repo>/`.
