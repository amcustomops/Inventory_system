<div align="center">
  
# 📦 Smart Inventory SaaS Platform
### Intelligent Multi-Tenant Inventory Ecosystem

An enterprise-grade, modern, and intelligent multi-tenant inventory management SaaS platform built on a scalable **Database-Per-Tenant** architecture. Features multi-location tracking, predictive stock-out ML analysis, centralized platform auditing, robust role-based access control, a unified HTML template mailer, dynamic Excel catalogs import, and a stunning Glassmorphism UI.

[![React](https://img.shields.io/badge/React-20232A?style=for-for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](https://expressjs.com/)
[![MariaDB](https://img.shields.io/badge/MariaDB-003545?style=for-the-badge&logo=mariadb&logoColor=white)](https://mariadb.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)

</div>

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Multi-Tenant SaaS Architecture](#-multi-tenant-saas-architecture)
- [Central Super Admin Portal](#-central-super-admin-portal)
- [Unified Email Service](#-unified-email-service)
- [Excel Catalog Import Engine](#-excel-catalog-import-engine)
- [Tech Stack](#-tech-stack)
- [Database Architectures (Central vs. Tenant)](#-database-architectures-central-vs-tenant)
- [Directory Structure](#-directory-structure)
- [Local Development Setup](#-local-development-setup)
- [API Documentation](#-api-documentation)
- [User Roles & Permissions (RBAC)](#-user-roles--permissions-rbac)
- [UI / UX Design Principles](#-ui--ux-design-principles)
- [Security Features](#-security-features)
- [License](#-license)

---

## 🚀 Overview

The **Smart Inventory SaaS Platform** is a multi-tenant software-as-a-service solution that enables businesses to manage physical inventory across multiple locations. Using a high-isolation **Database-Per-Tenant** pattern, the platform dynamically resolves and routes traffic to isolated MariaDB/TiDB tenant instances while exposing a central Super Admin control board.

The application bridges Express APIs, an isolated Python FastAPI machine learning microservice for demand forecasting and anomaly detection, and a high-performance React client designed with glassmorphic aesthetic details.

---

## 🌟 Key Features

### 1. High-Isolation Multi-Tenancy
- **Database-per-Tenant:** Complete physical and logical data isolation, preventing cross-tenant leakage.
- **Dynamic Context Routing:** Automatic connection pool resolution using `AsyncLocalStorage` and connection caching.
- **Automated Provisioning:** Dynamically spins up, runs schema migrations, seeds default roles, and onboard tenants on-the-fly.

### 2. Multi-Location Inventory Engine
- **Global Stock Visibility:** Real-time stock aggregates across all shop shelves and warehouses.
- **Movement Ledgers:** Atomic transactions for stock-in, stock-out, manual adjustments, and inter-location transfers.
- **Audit Trails:** Un-editable history tracking who performed which adjustments.

### 3. Intelligent Purchasing & Supplier Management
- **Purchase Orders (PO):** Multi-stage order workflows (`DRAFT` ➔ `PENDING` ➔ `APPROVED` ➔ `RECEIVED`).
- **Partial Receiving:** Automatically logs partial shipments and splits pending backorders.
- **Automated Mail Logs:** Complete audit trail of outgoing POs dispatched to vendor networks.

### 4. Scoped User Management
- **Invites Console:** Dynamic invitations matching company branding, complete with automatic password generation.
- **Status Controls:** Ability to suspend or reactivate staff accounts instantly.
- **Granular RBAC:** Permissions structure securing routes by role hierarchies.

### 5. Excel Catalog Import Engine
- **Bulk Imports:** Upload `.xlsx`, `.xls`, or `.csv` sheets to batch-populate inventory catalogs.
- **Dynamic Relations Mapping:** Non-existent categories or suppliers are resolved and created on-the-fly.
- **Interactive UI Logs:** Drag-and-drop file upload with live success stats and detailed warning lines for SKU collisions.

### 6. Predictive AI & Demand Forecasting
- **Stock-Out Warnings:** Regression analysis predicting depletion velocity and stock exhaustion days.
- **EOQ Calculation:** Computes Economic Order Quantity balancing holding and ordering costs.
- **Prophet/Exponential Smoothing Demand curves:** 7, 14, and 30-day time-series forecasting.
- **Dead Stock Anomalies:** Isolation Forest algorithms flagging capital trapped in stagnant items.

---

## 🗺️ Multi-Tenant SaaS Architecture

The platform handles scalability and security using a modular routing pipeline:

```text
       [React Client SPA]
               │
               │ (Request + Header: X-Tenant-Id)
               ▼
     [Express Core Gateway]
               │
               ▼
  [Tenant Resolver Middleware] ────(Lookup metadata)────► [Central Master DB]
               │
               ├─(Request pool)───► [Tenant DB Connection Manager]
               │                                   │
               ▼                                   ▼ (Cache pool / Init)
  [Business Route Controller] ─────────────────────┤
               │                                   ▼
               └─(Attach pool connection)───► [Tenant Database]
                                                   │
                                                   ▼
                                     [Python FastAPI ML Container]
```

1. **Context Initialization:** When a client request hits the Express server, `tenantResolver` extracts `X-Tenant-Id`.
2. **Registry Lookup:** The middleware checks the local cache or queries the Central Database to resolve the tenant's database name (`tenant_<tenant_id>`).
3. **Pool Allocation:** The connection manager (`tenantDbManager.js`) returns an existing pool from its memory cache or spins up a new pool dynamically, scheduling an idle-reaper to prune inactive connections after 15 minutes.
4. **Execution Bound:** Downstream controllers execution is wrapped inside a scoped environment using `AsyncLocalStorage` and attached to `req.db`.

---

## 👑 Central Super Admin Portal

The Super Admin interface is accessible via `/admin` and isolates platform administration from standard workspace views:
- **Global Metrics Dashboard:** Tracks aggregate registered tenants, status spreads, and projected platform MRR.
- **Tenant Management Directory:** Add new tenants (triggering SQL migrations and database creation), suspend workspaces, or reactivate accounts.
- **Centralized Auditing Stream:** A single platform-wide log viewer containing database mutation records with interactive before/after JSON inspectors.

---

## 📧 Unified Email Service

The backend contains a consolidated, template-driven email service in [mailer.js]:
- **Abstracted Transports:** Dynamically routes emails through Resend API, Brevo, or NodeMailer SMTP, with a local Ethereal/sandbox fallback.
- **Glassmorphic HTML Templates:** Shared styling system rendering responsive cards for `WELCOME_EMAIL`, `INVITE_USER`, and `PURCHASE_ORDER` templates.
- **BullMQ Background Queues:** Leverages BullMQ job managers with Redis; gracefully falls back to a synchronous, in-memory worker queue when Redis is offline.

---

## 📥 Excel Catalog Import Engine

Secured for Owners and Managers, the catalog importer parses spreadsheets with high reliability:
- **Stream Context Binding:** Multer's file uploads operate outside standard AsyncLocalStorage boundaries. The parser directly maps operations to `req.db.getConnection()` to prevent transactional drift to the central database.
- **Flexible Headers Parser:** Case-insensitive, whitespace-ignoring string matcher supporting multiple variations (e.g., `SKU`, `Product SKU`, `Code`).
- **Dry-run Collision Logs:** Inserts valid rows while catching duplicates or format errors, returning detailed report counts and row-by-row warnings without rolling back the entire sheet.

---

## 🏗️ Tech Stack

### Frontend
- **React 18 & Vite:** Lightning-fast HMR client bundle.
- **React Router DOM (v6):** Protected client routes and route-guarding logic.
- **Tailwind CSS:** Consistent dark-mode utility-first styling.
- **Framer Motion:** Smooth slide-up animations, spring physics, and glassmorphic card depth.

### Core Backend
- **Node.js (v18+) & Express:** RESTful request handling.
- **MariaDB Driver:** Native connection pools and transaction support.
- **Multer:** Buffered memory-storage parser for file uploads.
- **xlsx (SheetJS):** Tabular parsing of Excel workbook sheets.

### Python ML Service
- **FastAPI & Uvicorn:** Async REST API served on port 8000.
- **Scikit-Learn:** Linear regression (depletion trend) and Isolation Forests (dead stock).
- **Statsmodels:** Holt-Winters exponential smoothing curves.
- **Pandas & NumPy:** Tabular operations and normalization.

---

## 🗄️ Database Architectures (Central vs. Tenant)

### Central Registry DB Schema
- **`companies`**: Tenant listings, active schema databases, and operating status.
- **`plans`**: Subscription billing tiers (`Basic`, `Professional`, `Enterprise`) and system threshold limits (max users, max locations, max products).
- **`subscriptions`**: Dynamic subscription states and trial timestamps.
- **`platform_users`**: Administrative accounts (Super Admins).
- **`platform_audit_logs`**: System audit trails for write events across all workspaces.

### Tenant Scoped DB Schema (Created per Tenant)
- **`roles` / `permissions` / `role_permissions`**: Scoped RBAC matrices.
- **`users`**: Team profiles and salted bcrypt hashes.
- **`PRODUCTS`**: Inventory catalog (includes `ordering_cost` and `holding_cost` for predictive EOQ).
- **`LOCATIONS`**: Warehouse and store locations.
- **`INVENTORY`**: Quantities matrix mapped to products and locations.
- **`STOCK_MOVEMENTS`**: Immutable movements ledger.
- **`PURCHASE_ORDERS` / `PURCHASE_ORDER_ITEMS`**: B2B supply logs.
- **`SALES_HISTORY`**: Sales velocities used for predictive modeling.

---

## 📁 Directory Structure

```text
/
├── backend/                       # Multi-Tenant Express Application
│   ├── .env                       # Environment Configurations (Port 4000)
│   ├── db.js                      # Central & Tenant DB Proxy connection pool
│   ├── server.js                  # App Entry & Route Definitions
│   ├── schema.sql                 # SQL tables script for isolated tenant database
│   ├── setupCentralDb.js          # Initialization script for SaaS Master database
│   ├── setupDb.js                 # Automation script for single-tenant databases
│   ├── migrate_to_multitenant.js  # Migration script to convert database contents
│   ├── controllers/               # Controllers handling business logic
│   │   ├── adminController.js     # Platform metrics & tenant provisioning
│   │   ├── analyticsController.js # Dashboard aggregates & ML microservice gateway
│   │   ├── authController.js      # Tenant logins & password checks
│   │   ├── categoriesController.js# Category management endpoints
│   │   ├── inventoryController.js # Location-specific stock levels
│   │   ├── locationsController.js # Warehouse/shelf storage records
│   │   ├── productsController.js  # Product CRUD & Excel Catalog Imports
│   │   ├── purchaseOrdersController.js # B2B acquisition & status flow
│   │   ├── stockMovementsController.js # Transactional adjustments & movement history
│   │   └── usersController.js     # Tenant invites, delete, & status toggle
│   ├── jobs/                      # Background Queue Workers
│   │   └── worker.js              # BullMQ worker executing mail queue items
│   ├── middlewares/               # Request filters & validation
│   │   ├── authMiddleware.js      # Token parsing & claim authorization checks
│   │   └── tenantResolver.js      # X-Tenant-Id middleware resolver
│   ├── routes/                    # Express Router path mappings
│   │   ├── admin.js
│   │   ├── analytics.js
│   │   ├── auth.js
│   │   ├── categories.js
│   │   ├── inventory.js
│   │   ├── locations.js
│   │   ├── products.js
│   │   ├── purchase-orders.js
│   │   ├── stock-movements.js
│   │   └── users.js
│   ├── services/                  # SaaS Pipeline Services
│   │   └── onboardingService.js   # Provisioning (DB, RBAC tables, welcome mail)
│   └── utils/                     # Shared platform helpers
│       ├── auditLogger.js         # Writes database mutations to central audit logs
│       ├── context.js             # AsyncLocalStorage wrapper
│       ├── mailer.js              # Centralized SMTP & HTTP mail templates
│       ├── queue.js               # BullMQ setup with sync fallback
│       └── tenantDbManager.js     # Dynamic connection pools manager
│
├── frontend/                      # React Single Page Application (Vite)
│   ├── package.json               
│   ├── postcss.config.js          
│   ├── tailwind.config.js         # Theme configs
│   ├── vite.config.js             # Bundler settings
│   └── src/
│       ├── App.jsx                # Route guards and router config
│       ├── api.js                 # Axios instance with header interceptor
│       ├── index.css              # Custom styles
│       ├── main.jsx               # Entrypoint
│       ├── components/            # Layout shells
│       │   ├── AdminLayout.jsx    # Sidebar configuration for platform admins
│       │   └── Layout.jsx         # Sidebar configuration for tenant team members
│       └── pages/                 # Visual screens
│           ├── AdminDashboard.jsx # Central SaaS analytics and provisioning
│           ├── AdminLogin.jsx     # Platform portal login
│           ├── Dashboard.jsx      # Metrics overview with ML predictions
│           ├── Inventory.jsx      # Multi-location stock counts
│           ├── Login.jsx          # Tenant workspace login portal
│           ├── Products.jsx       # Catalog Grid & ImportModal Integration
│           ├── PurchaseOrders.jsx # PO draft, pending, and partial receiving
│           └── Users.jsx          # Employees Directory & Invite modal
│
└── ml-service/                    # Python FastAPI Intelligence Container
    ├── requirements.txt           # Scikit-Learn, Statsmodels, Pandas, etc.
    └── main.py                    # Predictive routes & modeling logic
```

---

## 💻 Local Development Setup

To boot the entire SaaS platform locally, run the services on their designated ports:

### 1. Central Database Boostrap
Ensure your local MariaDB instance is running. Create a `.env` in the `/backend` folder matching your local database parameters, then run:

```bash
cd backend
npm install

# Initialize the central platform tables
node setupCentralDb.js

# Initialize a default isolated tenant ('primary') and migrate legacy data
node migrate_to_multitenant.js
```

### 2. Launch Backend API
Still in the `/backend` directory:
```bash
npm start
```
The server will run on `http://localhost:4000` (port defined in your `.env`).

### 3. Launch Python ML Service
Open a new terminal tab:
```bash
cd ml-service
python -m venv venv

# Windows OS activation
.\venv\Scripts\activate
# macOS/Linux activation
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
FastAPI Swagger docs will mount on `http://localhost:8000/docs`.

### 4. Launch React Client
Open a third terminal tab:
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:5173`. To access the Central Admin dashboard, navigate to `http://localhost:5173/admin/login`.

---

## 🔗 API Documentation

All API requests (except platform admin logins and health checks) are tenant-scoped and require the `X-Tenant-Id` header to resolve the database pool. Most routes also require a valid JWT token passed in the `Authorization: Bearer <token>` header.

### 1. Authentication & Tenant Resolution
- **`POST /api/auth/login`**: Authenticate a tenant user. Accepts `{ email, password }`. Resolves tenant DB using `X-Tenant-Id` and returns a JWT containing user claims and RBAC permissions.
- **`POST /api/auth/register`**: Registers a new tenant and provisions their initial company owner account.
- **`POST /api/auth/admin-login`**: Authenticate a platform Super Admin against the central database.

### 2. Platform Super Admin Controls (`/api/admin`)
- **`GET /api/admin/metrics`**: Computes overall platform analytics (Total active tenants, subscription MRR, status split).
- **`GET /api/admin/tenants`**: Lists all onboarded companies, database mappings, and subscription statuses.
- **`POST /api/admin/tenants`**: Dynamic tenant database creation, RBAC schema execution, and email invitation dispatch.
- **`PUT /api/admin/tenants/:id/status`**: Toggle tenant company status (`ACTIVE` ➔ `SUSPENDED`).
- **`GET /api/admin/logs`**: Audit logs stream reflecting write operations across the entire platform.

### 3. Tenant User Management (`/api/users`)
*Secured for: `owner` and `manager` roles.*
- **`GET /api/users`**: List all team members within the tenant company along with their roles.
- **`POST /api/users`**: Invite a new colleague. Generates a hashed temporary password, creates the user, and queues a customized welcome/invitation email.
- **`PUT /api/users/:id/status`**: Toggle user status (`ACTIVE` / `SUSPENDED`). Prevents self-suspension.
- **`DELETE /api/users/:id`**: Permanent removal of an employee account from the tenant database. Prevents self-deletion.

### 4. Product Catalog (`/api/products`)
- **`GET /api/products`**: Fetch the complete product list with resolved category and supplier names.
- **`POST /api/products`**: *`[RBAC: owner, manager]`* Create a new catalog item. Requires `{ name, sku, cost_price, selling_price }`.
- **`PUT /api/products/:id`**: *`[RBAC: owner, manager]`* Update product details, safety stock thresholds, and track options.
- **`DELETE /api/products/:id`**: *`[RBAC: owner, manager]`* Remove a product from the database catalog.
- **`POST /api/products/import`**: *`[RBAC: owner, manager]`* Upload an Excel/CSV catalog file. Parses headers, resolves categories/suppliers on-the-fly, validates SKUs, and runs transactional batch inserts, returning individual row warnings for duplicates.

### 5. Warehouse & Stock Tracking (`/api/inventory` & `/api/stock-movements`)
- **`GET /api/inventory`**: Displays location-specific quantities of all products (shops vs. warehouses).
- **`GET /api/stock-movements`**: Complete audit logs of all physical stock movements.
- **`POST /api/stock-movements`**: *`[RBAC: owner, manager, warehouse]`* Record a new stock transaction. Accepts `{ product_id, location_id, type ('IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT'), quantity, reference }`. Updates the stock table atomically.

### 6. B2B Purchase Orders (`/api/purchase-orders`)
- **`GET /api/purchase-orders`**: Retrieve B2B order lists.
- **`POST /api/purchase-orders`**: *`[RBAC: owner, manager]`* Generate a Purchase Order and automatically email a responsive item details list to the supplier's address.

### 7. Predictive ML Analytics (`/api/analytics`)
- **`GET /api/analytics/dashboard`**: Overall dashboard telemetry (Totals, pending logs, low-stock metrics).
- **`GET /api/analytics/predictions/:product_id`**: Stock depletion rate, stock-out ETA (days remaining), and Economic Order Quantity (EOQ).
- **`GET /api/analytics/forecast/:product_id`**: Demand time-series forecast (FastAPI Holt-Winters).
- **`GET /api/analytics/classifications`**: Fast, Medium, and Slow moving segments (FastAPI KMeans Clustering).
- **`GET /api/analytics/dead-stock`**: Stagnant inventory alerts (FastAPI Isolation Forest).
- **`GET /api/analytics/expiry-risk`**: Expiry risk warnings for batch-tracked items.

---

## 🛡️ User Roles & Permissions (RBAC)

Tenant databases are pre-seeded with four default roles containing specific permission claims:
1. **`owner`**: Full administrative workspace permissions, user directory management, and audit inspection.
2. **`manager`**: Operational control (Purchase orders creation, locations, suppliers, catalog CRUD) except user management.
3. **`warehouse`**: Restricted view of financial figures; access to locations, and stock movement logs.
4. **`staff`**: View products and execute `STOCK OUT` movements.

---

## 🎨 UI / UX Design Principles

- **Harmonious Palette:** Custom deep slate background colors (`#0f172a`/`#1e293b`) prevent eye fatigue.
- **Layout Animations:** Sequential slide-ups using Framer Motion provide organic page loading.
- **Haptic Spring CTAs:** Scale and tap springs on buttons give satisfying click feedback.
- **Skeleton Screens:** Render layout frames instantly while resolving database requests in the background.

---

## 🔐 Security Features

1. **SQL Injection Defense:** Prepared queries with strict parameterized inputs.
2. **Bcrypt Hash Checks:** One-way salted hashes (10 rounds) secure passwords.
3. **Stateless JWT Claims:** Secure authentication using short-lived cryptographically signed tokens.
4. **Tenant Isolation Guards:** Strict database-per-tenant isolation enforced at the routing level.

---

## 📜 License

Distributed under the MIT License. See `LICENSE.txt` for details.
