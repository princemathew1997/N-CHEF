# n.chef — Commercial Kitchen Stock Tracker & Indent System

## Releases and rollback

Production uses manual semantic versions starting at **v1.0.0**. See the
[release and recovery guide](docs/RELEASING.md) for activation, publishing and
restoring a matching frontend/API deployment pair without resetting stock data.
Merging to main validates changes; it does not publish a production release.

## User guides

See the [role-based user wiki](docs/user-guides/README.md) for illustrated Admin,
Supervisor and Chef instructions and shareable PDFs. The wiki also records
[current gaps and limitations](docs/user-guides/implementation-gaps.md).

Raise to Vendor starts each consolidated ingredient with its catalog preferred
vendor and permits an override for that order. Saving creates one purchase order
per vendor atomically, without receiving or issuing stock. Download each vendor's
PDF separately from the saved-order cards or Vendors; supplier communication is
manual. Vendor documents include only that order's ingredients and vendor notes.

A modern, high-performance web application designed for commercial multi-branch restaurant operations. It coordinates stock requests raised by chefs across multiple cuisine sections, consolidates requirements through outlet supervisors, and routes batch indents to Admin for central approval and warehouse dispatch.

---

## 🌟 Core Architecture & User Roles

### 1. Chef Portal
- **Branch & Cuisine Locking:** Chefs (e.g. *Chef Priya* at *Yelahanka* for *Indian Cuisine*, *Chef Marco* at *Brigade Road* for *Continental*) only see and request items for their assigned outlet and cuisine.
- **Raise Request Wizard:** Step-by-step ingredient selection with real-time unit indicators and quantity inputs.
- **Request Tracking:** Real-time visibility into the status of raised requirements (`Pending Supervisor` → `Sent to Admin` → `Approved`).

### 2. Branch Supervisor Portal
- **Kitchen Sections Table:** Live dashboard grouping chef requests by active **Kitchen Cuisine Sections** (Continental, Indian, Chinese, Tandoor, etc.).
- **Item Adjustments:** Edit quantities on the fly with justification comments.
- **One-Click Indent Routing:** Click **`Send Sections Indent to Admin`** or **`Consolidate Indent`** to package all pending requirements into an official outlet indent with section breakdowns.
- **Stock Receiving:** Receive approved stock shipments directly into branch inventory.

### 3. Admin / Central Store Portal
- **Streamlined Indent Approval:** Admin approves branch orders exclusively through the **Indents** view.
- **Full Audit Breakdown:** Clicking **`Review & Approve`** on an indent displays:
  - Total consolidated requirements per ingredient.
  - Granular **Chef & Cuisine Section breakdown** with percentage share.
  - Supervisor alterations & comments.
- **Central Inventory Allocation:** Approving an indent automatically allocates stock from central inventory to the branch and fulfills all linked chef requests.
- **Master Data Management:** Manage master ingredients, vendor catalogs, outlet locations, and user roles.

---

## 📁 Repository Structure

```
├── assets/
│   └── images/
│       ├── chef_bg.jpg                        # Background hero asset
│       └── logo.jpg                           # Application branding asset
├── css/
│   └── styles.css                             # Core design system & theme
├── js/
│   ├── data.js                                # Data models & local storage persistence
│   ├── app.js                                 # Main controllers, indents & approvals
│   └── wizard.js                              # Chef request wizard & user management
├── docs/
│   └── Restaurant_Inventory_Change_Requirements.md # Technical workflow specifications
├── index.html                                 # Single-Page Application interface
├── package.json                               # Project metadata & start script
├── .gitignore                                 # Git ignore patterns
└── README.md                                  # Project overview and documentation
```

---

## 🚀 Getting Started

The app now uses Cloudflare Workers APIs and a shared D1 database. Node.js 24
is recommended. Local development uses an isolated D1 database:

```bash
npm ci
npm run db:local
node scripts/setup-key.mjs
npm start
```

Open `http://localhost:8000/setup.html` for first-admin setup, then sign in at
`http://localhost:8000`. Use the setup key from ignored `.dev.vars`. Choose a
password with at least 4 characters. A generic Python/static server cannot
run the database API and must not serve the repository containing local secrets.

Production uses Cloudflare Pages plus the private `nchef-api` Worker and
`nchef-db` database. See [database and deployment guide](docs/D1_MIGRATION.md)
for the API, permissions, testing, transaction behavior, and deployment order.
Other devices receive confirmed updates through 10-second polling.

---

## 🔐 Accounts

There are no demo accounts in the shared database. The first administrator
creates supervisors and chefs with assigned outlets and cuisine sections.
Passwords are salted and hashed server-side; session cookies expire after
8 hours. Browser storage retains only view preferences, not credentials or
business data. Local and production accounts are separate.

---

## 📄 License
ISC

## Item catalog and outlet stock

Administration → Item Catalog manages item metadata and active status. Only admins
can create or edit catalog items. Catalog creation never adds stock. Units become
read-only after stock history exists; existing duplicate names are flagged for
review, while new duplicates are rejected.

Admins and supervisors use Stock to receive quantities into permitted outlets,
distribute quantities to cuisine sections, record physical-count adjustments with
reasons, and inspect transaction history. Distribution deducts immediately; there
is no second consumption deduction or separate cuisine balance. Request approval
and purchase-order receiving use this same ledger.

Migration `0005_outlet_stock.sql` preserves original item payloads and prior movement
history, creates opening outlet quantities from allocations minus consumption,
and retains shared remainder as unassigned legacy stock. Admins assign that
remainder through Stock → Assign Legacy Stock. Inconsistent legacy data is flagged
and blocked from receipts/distributions until an admin verifies counts and saves
reconciliation with a reason. Original quantities remain visible for review.
Apply migrations before deploying this version; production migration and deployment
are separate from local testing.

For a disposable local preview: `npm run build` then `node scripts/qa-server.mjs`.
Open `http://127.0.0.1:8888`, using `qa_admin` / `qa-only-password-2026`.
The in-memory test database resets when the preview server restarts.

Master Orders reports one permitted outlet at a time, restoring the last outlet
selected by each user. Its category/item filters and IST From/To dates control
opening stock, receipts (including legacy assignments), per-cuisine distributions,
adjustments, and remaining stock. Today is calculated in Asia/Kolkata. Logged
instants remain stored in UTC and are displayed with explicit IST timestamps.
Stock Overview is admin-only; supervisors use Master Orders and their permitted
stock actions. Stock forms use searchable item selection and lock the outlet when
only one is assigned.

Supervisors raise their own requirements under Requests → Raise Request. These
persist as ordinary outlet requests and appear with chef requests in consolidation.
Edit quantities in the cuisine columns; ingredient and grand totals are calculated
and cannot be edited directly. Revised quantities and the cuisine breakdown are
saved together and used for stock distribution on approval.

## Operations workflow release

See the [current role guides](docs/user-guides/README.md) for Executive Chef, Purchaser (Supervisor), Cuisine Head and Admin. Migration `0006_operations.sql` preserves account IDs and credentials, maps existing Supervisors to Executive Chef, and adds operation records and priced receipts. Apply migrations 0007 and 0008 as well: they update role titles and prevent historical approvals from being issued twice. The compatibility epoch is `operations-v2`; deploy the matching API and frontend together. Rehearse the migration on a database copy, verify foreign keys, and apply it before releasing the new pair. Do not roll back to the old role/stock workflow after this migration. No production migration is run by the test scripts.

Run `npm test`, `python -m unittest discover -s tests -v`, `node scripts/check-migrations.mjs`, and `npm run build`. Browser validation uses a fresh disposable `node scripts/qa-server.mjs`, then `node scripts/qa-operations.cjs` with `NCHEF_PLAYWRIGHT_ROOT` pointing to the bundled Node package directory. The QA server uses only an in-memory local database.
