# Connect360 Partner Portal — Business Analysis & Site Plan

## 1. What the brochure tells us

| Item | Detail |
|---|---|
| Name | **Connect360 Business Solutions** |
| Pillars | Strategy · Efficiency · Sustainable Growth |
| Taglines | "Your Business, Our Expertise, 360° Solutions" · "Your Growth. Our Commitment." · "Let's Build a Stronger Future Together" · "Better Decisions, Stronger Operations, Higher Profits" |
| Profile | Helps businesses identify challenges, plug income leakages, optimise fund flow, control costs and build stronger, more profitable, sustainable operations. |
| Positioning | Business management & consultancy firm; strategic partner across finance, operations, technology, people and processes. |
| Vision | Trusted business-solutions partner for SMEs, traders and manufacturers through innovative, practical, sustainable solutions. |
| Mission | Improve profitability, strengthen financial management, reduce unnecessary costs, enhance operational efficiency, create lasting value. |
| Services (8) | Business Management & Expert Consultancy · Fund Flow & Working Capital Management · Income Leakage Identification · Cost Optimization · Software Solutions (accounting, inventory, ERP, CRM) · Manpower Recruitment · Process Improvement · Regulatory-Compliance-Aware Business Referrals (banking, lending, insurance, financial services, technology) |
| Methodology (6) | Understand → Analyze → Identify → Recommend → Implement → Monitor |
| Target clients | SMEs · Traders & wholesalers · Manufacturers & subcontractors |
| Why us (6) | Practical advice · Industry understanding · Financial & operational expertise · Customised solutions · Access to trusted technology / recruitment / service partners · Measurable results & long-term relationships |
| Contact | Thrissur, Kerala (operating across India) · +91 98765 43210 · info@connect360.in · www.connect360.in |
| Design | Deep navy (#0B1F3F) + gold (#C9A04A), white panels, line icons in gold circles, script accent font for the tagline, circular "360" arrow logo. |

**Growth read:** the "trusted partner network" (vendors) is the firm's core asset — every referral, cost-saving or
software recommendation is fulfilled by a vendor. The internal app therefore centres on the **vendor register** and
**which executive owns each relationship**, so the 10 partners can see coverage, avoid duplicate outreach and measure
who is bringing in partners.

## 2. Roles

| Role | Can do |
|---|---|
| **Admin** | Everything: add / edit / delete executives, add / edit / delete any vendor, export data, reset local changes. |
| **Executive** | View all vendors and executives; add vendors (auto-assigned to themselves); edit vendors they own. Executives page is read-only. |
| Public (not logged in) | About and Contact pages only. |

## 3. Page by page

### 3.1 Login (`/` → `index.html`)
- Brand panel (logo, pillars, tagline) + username / password form.
- Validates against `data/users.json`; stores session in `sessionStorage`; redirects to Vendors.
- Links to About / Contact for visitors.

### 3.2 Vendors — Home (`/vendors`)
- KPI strip: total vendors, active partners, categories covered, onboarding pipeline.
- Toolbar: **full-text search** (name, profile, remarks, services, contact person, area), filters for category,
  executive and status, **+ Add Vendor / Service** button.
- Table: vendor, category, services, contact, area, owning executive, status, onboarded date.
- Row click → detail panel with full profile, remarks, services, contact and owner; Edit / Delete per permissions.
- Add / Edit form: name, category, services (comma separated), contact person, phone, email, address, area,
  executive, status, onboarded date, profile, remarks.
- `?exec=E03` deep link pre-filters by executive (used from Executives page).

### 3.3 Executives (`/executives`)
- Summary: executive count, total vendors, average vendors per executive, top performer.
- Card per executive: name, designation, sector focus, phone, email, joined date, **vendor count**, active count,
  "View vendors" link.
- Admin only: **+ Add Executive**, Edit, Delete (delete is blocked while vendors are still assigned), optional login
  creation. Everyone else sees a "Read-only" badge and no controls.

### 3.4 About (`/about`)
- Hero with company profile, About Us, Vision, Mission, Why Choose Us, 8 Services, 6-step Methodology, Target Clients.

### 3.5 Contact (`/contact`)
- Address, phone, email, website cards; enquiry form that opens the user's mail client to info@connect360.in.

## 4. Data (text files, no DB yet)

| File | Shape | Future DB table |
|---|---|---|
| `data/vendors.json` | 30 Thrissur businesses: `id, name, category, services[], contactPerson, phone, email, address, area, executiveId, status, onboardedOn, profile, remarks` | `vendors` (FK `executive_id`) |
| `data/executives.json` | 10 executives: `id, name, designation, phone, email, sector, joinedOn, bio` | `executives` |
| `data/users.json` | `username, password, role, executiveId` | `users` (hashed passwords!) |

Business names are real Thrissur businesses picked from a web search; **all contacts, people, statuses and remarks are
dummy values**.

Changes made in the UI are stored in the browser (`localStorage`) on top of the JSON files, because a static
Vercel deployment cannot write files. Admin can **Export JSON** to download the merged data and commit it back.

## 5. Moving to a real backend later
1. Replace `C360.store()` in `assets/js/app.js` with API calls (same `all / add / update / remove` methods).
2. Move auth to a server (Vercel Functions + Postgres/Supabase, hashed passwords, HTTP-only cookies).
3. Add audit fields (`createdBy`, `updatedAt`) and vendor activity log.

## 6. Known limitations of the demo
- Login is client-side and **not secure** — passwords sit in a public JSON file. Demo only.
- Edits are per-browser; other team members won't see them until data is exported and redeployed.
