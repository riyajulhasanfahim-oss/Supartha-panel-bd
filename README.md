# RJ-SMM White-Label Digital Panel

**Version:** `v1.0.0` — **Commercial Multi-Buyer Edition**  
**Schema Version:** `1.0.0`

A production-ready, multi-buyer White-Label Social Media Marketing (SMM) Panel built with **React 19**, **TypeScript**, **Tailwind CSS**, **Express (`server.ts`)**, **Firebase Authentication**, and **Cloud Firestore**.

Each commercial buyer runs an isolated installation wired to their **own Firebase Project**, **SMM Provider API**, **Payment Methods**, **Service Catalog**, and **Brand Identity** — with strict RBAC security rules, atomic wallet/order transactions, duplicate-order protection, and server-side API key isolation.

---

## v1.0.0 Release Notes

- **Multi-Buyer White-Label Architecture**: Isolated Firebase Project & Firestore Database binding per installation via `firebase-applet-config.json` or Admin Panel runtime override (`src/lib/firebase/configManager.ts`).
- **Dynamic Branding & Currency Engine**: Live updates for Website Name, Tagline, Logo, Favicon, Primary/Secondary Theme Colors, Hero/About/FAQ CMS content, Contact Info, and Currency (`currency`, `currencySymbol`) across Landing, Auth, Customer Dashboard, and Admin Console.
- **Guided 8-Step Setup Wizard & Idempotent Database Engine**: One-click connection test, non-destructive database initialization, database repair, demo catalog cleanup, and safe JSON configuration backup/restore (never exposes API keys).
- **Atomic Financial & Order Integrity**: Firestore `runTransaction` ledger accounting for order placement, wallet deduction, duplicate-submission lock, manual deposit approval/rejection, and single-refund enforcement.
- **Server-Side SMM Provider Proxy (`server.ts`)**: All upstream provider API calls (`/api/orders/dispatch`, `/api/orders/sync-status`, `/api/provider/execute`) execute exclusively on the backend with SSRF protection, Admin Bearer verification, exponential retry backoff, and sanitized error messages. Upstream API keys are never returned to customer views.
- **Role-Based Admin Console (RBAC)**: Supports `super_admin`, `admin`, `manager`, and `support_staff` roles backed by `adminUsers` + hardened `firestore.rules`, real-time support ticket chat, notifications, and immutable `auditLogs`.

---

## 12-Step Buyer Installation & Launch Guide

Follow these 12 steps in order to deploy a clean commercial installation for a buyer.

### Step 1: Install Project Dependencies
Verify Node.js `v20+` (or `v22+`) is installed, then install dependencies:
```bash
npm install
```

### Step 2: Create a Dedicated Firebase Project (Buyer-Isolated)
1. Open the [Firebase Console](https://console.firebase.google.com/) and create a new Firebase Project for the buyer.
2. Register a **Web App** inside Project Settings and copy the Firebase SDK config (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).
3. Enable **Cloud Firestore** in Production Mode (note the database ID, usually `(default)` or a named database).
4. Enable **Firebase Authentication** providers:
   - **Email/Password** (for customer registration, login, and password reset)
   - **Google** (for Super Admin / staff login and customer social login; add your production domain to **Authorized Domains**).

### Step 3: Bind Firebase Credentials
Choose either method:
- **Build-time binding (Recommended for fresh deployment):** Update `firebase-applet-config.json` in the project root with the buyer's Web App config and `firestoreDatabaseId`.
- **Runtime Admin binding:** Sign in as Admin and enter the buyer's Firebase credentials inside **Admin Panel → Firebase / Setup Wizard** (saved cleanly per installation, with live connection verification before saving).

Also configure `.env` from `.env.example` for your server environment:
```bash
cp .env.example .env
```
Set `APP_URL`, `PORT` (default `3000`), and `NODE_ENV=production` for live hosting.

### Step 4: Configure Bootstrap Admin & Deploy Firestore Security Rules
1. Before deploying `firestore.rules`, update the bootstrap owner email in:
   - `firestore.rules` (`isBootstrapOwner()` -> buyer's verified Super Admin Gmail address)
   - `src/services/admin.service.ts` (`BOOTSTRAP_ADMIN_EMAIL`)
   - `src/lib/firestore/initializer.ts` (bootstrap check)
2. Lint and deploy `firestore.rules` to the buyer's Firebase project (see the **Production Firestore Rules Deployment Guide** below):
   ```bash
   npx eslint firestore.rules
   firebase deploy --only firestore:rules
   ```

### Step 5: First Admin Login & Database Initialization
1. Open the panel and sign in using the verified Super Admin Google account.
2. Open **Admin Panel → Setup Wizard**.
3. Run **Test Firebase Connection** and click **Initialize Database**.
4. Confirm that `settings/system`, `settings/setup`, `adminUsers`, `users`, and default `categories` are created idempotently (no manual collection creation required).

### Step 6: Configure White-Label Branding & Currency
1. Go to **Admin Panel → Settings / White-Label**.
2. Set:
   - **Website Name**, **Brand Tagline**, **Logo URL**, and **Favicon URL**
   - **Theme Colors** (Primary & Secondary brand colors)
   - **Currency Code** (e.g., `USD`, `BDT`, `EUR`, `INR`) and **Currency Symbol** (e.g., `$`, `৳`, `€`, `₹`)
   - **Support Email**, **WhatsApp**, **Support Hours**, **Hero Banner**, and **FAQ Content**
3. Save and verify changes reflect across Landing, Login, Customer Dashboard, and Admin views.

### Step 7: Connect SMM API Provider(s)
1. Go to **Admin Panel → API Providers**.
2. Click **Add Provider** and enter the buyer's upstream SMM v2 API URL (must be `https://` public domain) and API Key.
3. Click **Test Connection** — the server proxy verifies live balance & currency via `POST /api/provider/execute`.
4. Set status to **Active**. (Provider API keys remain hidden from all customer queries and frontend bundles.)

### Step 8: Configure Categories & Services
1. Go to **Admin Panel → Categories** to organize platforms (Instagram, YouTube, TikTok, Facebook, Telegram, X, etc.).
2. Go to **Admin Panel → Services**:
   - Import services directly from the active API Provider or create services manually.
   - Map `Provider`, `Provider Service ID`, `Cost Price`, `Customer Selling Price` (or profit margin), `Min/Max Quantity`, `Average Delivery Time`, `Service Type`, and set status to **Active**.
3. If switching straight to real catalog services, click **Clear Demo Catalog** inside Setup Wizard / Maintenance to remove starter demo items (`isDemo: true`).

### Step 9: Configure Payment Methods
1. Go to **Admin Panel → Payments / Payment Methods**.
2. Add or edit the buyer's deposit methods (e.g., Mobile Banking, Bank Transfer, Crypto, Gateway Instructions) with exact account numbers, instructions, min/max limits, and set status to **Active**.

### Step 10: Configure Staff Roles (RBAC)
1. Go to **Admin Panel → Staff / Role Management** (Super Admin only).
2. Add `admin`, `manager`, or `support_staff` accounts as needed.
3. Each staff member's permissions are enforced both in the UI and inside `firestore.rules`.

### Step 11: Run Pre-Launch Verification & Production Build
Run type-checking, security rules linting, and production bundling:
```bash
npm run lint
npx eslint firestore.rules
npm run build
```
Verify `dist/` builds cleanly with zero TypeScript errors and zero embedded provider/server secrets.

### Step 12: Deploy to Production & Enable Production Mode
1. Start the production server (`NODE_ENV=production node server.ts` or `npm start`) on your VPS / Cloud Run / container host on port `3000` (or configured `PORT`).
2. Complete a small end-to-end live check (test user registration → deposit approval → test order → status sync → ticket reply), then delete your temporary test records.
3. In **Admin Panel → Setup Wizard**, enable **Production Mode** (`productionMode: true`) and confirm `maintenanceMode` is `false`.

---

## Guide Reference

### Production Firestore Rules Deployment Guide
Never run a buyer panel in Firestore "Test Mode" (`allow read, write: if true;`). Always deploy `firestore.rules`:
1. Install Firebase CLI if not already installed: `npm install -g firebase-tools`
2. Authenticate & select the buyer's project:
   ```bash
   firebase login
   firebase use <BUYER_FIREBASE_PROJECT_ID>
   ```
3. Validate rules syntax locally with Firebase's official security-rules ESLint plugin:
   ```bash
   npx eslint firestore.rules
   ```
4. Deploy rules:
   - Default `(default)` database:
     ```bash
     firebase deploy --only firestore:rules
     ```
   - Named Firestore database (configure `firebase.json` `"firestore": { "database": "<db-id>", "rules": "firestore.rules" }`):
     ```bash
     firebase deploy --only firestore
     ```
5. Verify in Firebase Console → **Firestore Database → Rules** that the active rules match `firestore.rules` (see `security_spec.md` and `firestore.rules.test.ts` for the full 12-vector security matrix).

### Provider API Setup Guide
- Supports standard SMM Panel v2 JSON POST APIs (`action=balance`, `action=services`, `action=add`, `action=status`).
- Requests are proxied exclusively through `server.ts` (`POST /api/provider/execute`, `POST /api/orders/dispatch`, `POST /api/orders/sync-status`).
- Server-side SSRF rules block private IPs (`127.0.0.1`, `10.*`, `169.254.*`, `localhost`, `.internal`).
- Customers never see `providerId`, `providerOrderId`, `providerCharge`, `apiUrl`, or `apiKey`.

### Payment & Wallet Ledger Guide
- Customer balance lives strictly on `users/{uid}.balance` and cannot be increased by the customer from the frontend (`firestore.rules` blocks client balance inflation).
- Every deposit approval, order deduction, admin adjustment, and refund writes an immutable ledger entry to `transactions/{txnId}`.
- Duplicate payment approvals and duplicate refunds are blocked via Firestore `runTransaction` state guards.

### Admin & Customer Order Lifecycle
- Internal statuses: `Pending`, `Processing`, `In Progress`, `Completed`, `Partial`, `Cancelled`, `Failed`.
- Rapid double-clicks on Order Submission are blocked by UI lock + idempotency lock + Firestore atomic balance transaction.
- Failed/Cancelled/Partial orders support controlled atomic refunds back to the customer's wallet with notification dispatch.

---

## Buyer Pre-Launch Checklist

- [ ] Firebase Project created
- [ ] Firestore Rules deployed
- [ ] Firebase Authentication enabled
- [ ] Admin account created
- [ ] Database initialized
- [ ] White-label branding updated
- [ ] Currency configured
- [ ] Payment methods added
- [ ] API provider connected
- [ ] Services added/imported
- [ ] Test order completed
- [ ] Production mode enabled
- [ ] Domain / SSL verified

---

## Step 13 — RJ WORLD BD Reseller API Gateway Architecture

- **Master Admin Upstream Providers**: Only Master Admin (`Admin Panel → API Providers`, `Services`, `Setup Wizard`) configures upstream SMM Provider URLs and API Keys, tests connections, checks balances, and imports/maps services. Upstream keys stay isolated in Admin-only Firestore rules (`apiProviders`) and server proxy routes (`server.ts`).
- **Auto-Provisioned Reseller API Access**: Every active registered customer automatically receives their own Reseller API profile (`apiCustomers/reseller-{uid}`) and a unique SHA-256 hashed API Key (`rjw_live_...`, plaintext shown once upon initial creation or regeneration via `POST /api/gateway/keys/generate` and `POST /api/gateway/keys/regenerate`).
- **Reseller API Forwarding Endpoint (`POST /api/v2`)**: Standard SMM Panel API v2 compatible endpoint supporting `balance`, `services`, `add` (atomic API balance deduction, idempotency protection, automatic upstream provider forwarding, and automatic refund on upstream failure), and `status` (single or comma-separated bulk queries with live upstream status sync and zero upstream provider leakage).
- **Zero Lock-Mode Env Vars**: No per-installation `.env` API locks or hashing pepper variables are required. Backend `POST /api/v2` resolves Google Cloud Application Default Credentials (Metadata Server) automatically on managed cloud hosts or uses optional `FIREBASE_SERVICE_ACCOUNT_JSON` / `GOOGLE_APPLICATION_CREDENTIALS`.

