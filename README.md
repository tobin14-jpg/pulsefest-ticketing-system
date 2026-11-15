
# PulseFest

A small university music festival ticket reservation and event management project extending the IFQ636 React/Express/MongoDB starter.

## Current scope

- PFT-5: authenticated festival browsing with availability and loading, empty, error and sold-out states.
- PFT-6: reserve 1–4 tickets, receive a persisted unique reference, view a private confirmation and see updated availability. Transactions prevent overselling and partial writes.
- Existing registration, JWT login, password hashing and profile functionality are preserved.
- Organiser roles, event creation/capacity editing, deployment configuration and CI repair remain **pending** their next Jira increments.

The intended roles are attendee (browse and reserve) and organiser (create events and manage capacity). Only the attendee workflow is implemented so far; there is no organiser role or public event-write endpoint yet.

## Local setup

From this repository directory, using Node 22 and npm:

```sh
npm ci --prefix backend
npm ci --prefix frontend
```

Copy `backend/.env.example` to `backend/.env` only if you do not already have one. Configure:

| Variable | Value |
| --- | --- |
| MONGO_URI | Development Atlas or replica-set URI with a dedicated database |
| JWT_SECRET | Unique random secret; never commit it |
| PORT | Backend port, default 5001 |
| NODE_ENV | `development` locally; `production` on the eventual deployment |

For Atlas, use a dedicated database account and restrict network access to the development computer or university EC2 host. Bookings require Atlas or a replica set, not standalone MongoDB. The database user needs permission to create reservation uniqueness indexes at startup. Keep credentials in the ignored `.env` file.

In separate terminals:

```sh
npm run dev --prefix backend
npm start --prefix frontend
```

Open `http://localhost:3000`. Relative `/api` requests use the development proxy to port 5001. The starter's React development server encountered an `allowedHosts` error on the current Windows host; an agent-started production-build preview at `http://127.0.0.1:3000` is being used instead. It also proxies `/api` to the backend, and serves the last build, so rebuild after frontend edits.

## Optional development festival

Until organiser creation is available, this explicit command inserts one labelled demo event into the database selected by `backend/.env`. Use a development database only and register a test account first. The earliest account is used solely as the fixture's creator reference; no accounts or roles are changed. An existing demo event and its bookings are left unchanged.

PowerShell:

```powershell
$env:NODE_ENV = 'development'
npm run seed:festival --prefix backend
```

Ubuntu/macOS:

```sh
NODE_ENV=development npm run seed:festival --prefix backend
```

**PulseFest Demo Festival** has 12 tickets, a displayed AUD 25 ticket price and a date 30 days after creation. This is a real MongoDB document, not mocked UI data. Seeding is not automatic; no sample event has been added to the user's database by this increment.

## Attendee workflow

Log in, select a festival, choose 1–4 tickets and confirm. A transaction saves the booking and updates the event counter together. The confirmation page retrieves the saved reservation and shows its reference. Return to listings to see new availability. Save the confirmation URL/reference; no tickets are emailed.

If a response is uncertain, retry the same quantity on the open form without refreshing. Its request ID prevents a duplicate booking. A new form or changed quantity creates a distinct request. Authentication remains in memory, so refreshing requires login again; protected confirmation links return to their original path after login.

See [PFT-6 API, implementation, review and acceptance checks](docs/PFT-6.md).

## Tests and production build

```sh
npm test --prefix backend
npm run test:ci --prefix frontend
npm run build --prefix frontend
```

Backend tests require `mongod` on PATH or `MONGOD_BINARY` set to its executable path. They create an isolated loopback replica set with temporary data and clean it up afterward, never using the application database. Local tests used MongoDB 5.0.2. UI tests use the existing React/Jest tools with mocked HTTP responses.

Verified on 14 November 2026: **16 backend tests passed, 11 frontend tests passed and production build compiled successfully**. Existing CRA/Browserslist/React Router warnings remain. No dependencies were added. Browser acceptance testing and actual Atlas reservation writes remain manual checks.

## Architecture

- `backend/server.js`: Express app, route mounting and startup/index initialisation.
- `backend/config/db.js`: existing MongoDB connection.
- `backend/models/User.js`: existing user and bcrypt password hashing.
- `backend/models/Event.js`: event fields, capacity and reserved counter.
- `backend/models/Reservation.js`: event/attendee IDs, quantity, unique reference and retry request ID.
- `backend/controllers/` and `routes/`: existing separation of HTTP routing and database operations.
- `backend/middleware/authMiddleware.js`: JWT authentication with database user lookup.
- `frontend/src/context/AuthContext.js`: in-memory authentication.
- `frontend/src/pages/`: login/register/profile, listings, reservation and confirmation.
- `frontend/src/components/`: reusable navigation, card, field, button and alert.

A conditional atomic capacity increment and a reservation insert execute inside the same transaction; either both commit or both roll back. Unique indexes protect booking references and per-attendee retry IDs. The later organiser capacity update must conditionally reject values below the reserved count on the same event document.

## Deployment status and known limitations

**Verified public deployment URL: not deployed — replace only after EC2 verification.**

The intended stack is React, Node/Express, Atlas, PM2 and Nginx on the university Ubuntu instance. Exact EC2 instructions, health check, PM2/Nginx examples and repaired GitHub-hosted CI remain for the deployment increment. The inherited CI is not verified working. No infrastructure was created or changed.

Public authentication must use the university-approved HTTPS/certificate or managed TLS termination approach. Do not expose credential submission over plain HTTP. Production API URLs are relative and do not require an embedded EC2 address. The frontend uses browser crypto UUIDs, available on HTTPS and localhost.

This is a simplified academic prototype: no payments, email tickets, QR scanning, refunds or seat selection. No organiser dashboard or booking-history screen yet. Sessions are in memory; broader starter authentication hardening remains pending. No pagination. The 1–4 ticket limit is per reservation, not a cumulative per-user limit. No public deployment has been verified.

## Original university starter brief

**Assessment 1.2 (Total Marks **20**)**

Assignment: **Software requirements analysis and design (**Full-Stack CRUD Application Development with DevOps Practices**)**


---

**Objective**

For this assessment, you have already been assigned a project. Your task is to develop a system that implements CRUD (Create, Read, Update, Delete) operations based on the selected project. The system should include both a user panel and an admin panel. Depending on the nature of your chosen project, you may decide how many CRUD operations are required to support the functionality of the system. You have been provided with a starter project that includes user authentication using Node.js, React.js, and MongoDB, your should extend this application based on your assigned project requirements. Ensure that the implemented features are appropriate and meaningful for your selected project. Your project should include the following:
In this assignment you will complete the following tasks:

* **Basic Version Control using GitHub**
* **Development, CI/CD Integration for Automated Deployment**
* **Project report**

 
---

**GitHub link of the starter project: **[https://github.com/nahaQUT/sampleapp_IFQ636.git](https://github.com/nahaQUT/sampleapp_IFQ636.git)

---

