# n.chef — Commercial Kitchen Stock Tracker & Indent System

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
password with at least 12 characters. A generic Python/static server cannot
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
