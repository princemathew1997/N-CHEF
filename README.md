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
├── index.html                                 # Main Single Page Application interface
├── styles.css                                 # Core design system (dark culinary theme)
├── data.js                                    # Data models, seed data & localStorage persistence
├── app.js                                     # Core application logic, routing & tables
├── wizard.js                                  # Chef request wizard & user management logic
├── chef_bg.jpg                                # Background hero asset
├── logo.jpg                                   # Branding asset
├── Restaurant_Inventory_Change_Requirements.md # Technical workflow specifications
├── package.json                               # Project metadata & launch scripts
├── .gitignore                                 # Git ignore configuration
└── README.md                                  # Project overview and documentation
```

---

## 🚀 Getting Started

No build step or external compilers required. Run with any local HTTP server:

### Option 1: Python
```bash
python -m http.server 8000
```

### Option 2: Node.js (npx)
```bash
npx serve -p 8000 .
```

Open `http://localhost:8000` in your web browser.

---

## 🔐 Default Demo Accounts

| Role | Username | Password | Assigned Location / Cuisine |
|---|---|---|---|
| **Admin** | `admin` | *(any)* | All Outlets / Central Store |
| **Supervisor** | `supervisor` | *(any)* | Brigade Road / Yelahanka |
| **Chef (Continental)** | `chef_prince` | *(any)* | Brigade Road — Continental |
| **Chef (Indian)** | `chef_priya` | *(any)* | Yelahanka — Indian |
| **Chef (Chinese)** | `chef_li` | *(any)* | Brigade Road — Chinese |
| **Chef (Tandoor)** | `chef_arun` | *(any)* | Yelahanka — Tandoor |

---

## 📄 License
ISC
