# Connect360 Partner Portal

Internal portal for Connect360 Business Solutions (Thrissur). It tracks service vendors and the executive who owns
each relationship. The site is static HTML, CSS and JS. All data is read from JSON text files in `data/`. See
`PLAN.md` for the business analysis and the page-by-page plan.

## Pages
| Page | File | Access |
|---|---|---|
| Login | `index.html` | public |
| Vendors (home) | `vendors.html` | logged in |
| Executives | `executives.html` | logged in; read-only unless admin |
| About | `about.html` | public |
| Contact | `contact.html` | public |

## Demo logins
- Admin: `admin` / `admin@360`
- Executive: `divya` / `c360@2026` (also `rahul`, `sreeja`, `jithin`, `fathima`, `arun`, `neethu`, `midhun`, `aswathy`)

## Run locally
The pages load JSON with `fetch`, so you have to serve them over HTTP. Opening the files directly won't work.

```bash
cd connect360-portal
python3 -m http.server 8080      # or: npx serve .
# open http://localhost:8080
```

## Deploy to Vercel
```bash
npm i -g vercel
cd connect360-portal
vercel            # preview
vercel --prod     # production
```
Or push the folder to GitHub and import it in Vercel with Framework Preset **Other**. No build command is needed,
and the output directory is the project root.

## Editing data
- Edit `data/vendors.json`, `data/executives.json` and `data/users.json`, then redeploy.
- Anything added or edited in the UI is saved in that browser's `localStorage` only. To keep those changes, an admin
  clicks **Export JSON**, replaces the file in `data/` and redeploys.

## Important
- Login runs in the browser and the passwords sit in a public file. This is **for demo only**. Move auth to a server
  before you store real data.
- Vendor business names are real Thrissur businesses from a web search. All contacts, people, statuses and remarks
  are placeholders.
