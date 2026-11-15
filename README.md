# PulseFest — Festival Ticketing System

PulseFest is a full-stack web application developed for the IFQ636 Software Lifecycle Management assignment. It allows attendees to browse music festivals and reserve tickets, while organisers can create festivals and manage ticket capacities.

## 1. Live Deployment

**Deployed application:** http://YOUR_EC2_PUBLIC_IP

**Figma interactive prototype:** [Insert view-only Figma link]

The application is hosted on a university-provided AWS EC2 Ubuntu instance.

**Note:** The current public deployment uses HTTP. HTTPS is required before entering real credentials over the internet. The deployment may also be unavailable after the university assessment period.

## 2. Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, React Router, Axios |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas |
| Authentication | JWT-based authentication |
| Hosting | AWS EC2 (Ubuntu) |
| Web server | Nginx |
| Process management | PM2 |
| Version control | GitHub |

## 3. Setup Instructions

### Prerequisites

- Node.js and npm
- Git
- MongoDB Atlas connection string

### Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd pulsefest-ticketing-system
```

### Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory with the environment variables required by the application.

Example:

```env
PORT=5001
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

Confirm the exact variable names against the backend source code.

Start the backend using its configured start script:

```bash
npm start
```

The production deployment runs the Express backend on port 5001.

### Frontend Setup

Open a second terminal:

```bash
cd frontend
npm install
npm start
```

The React development server normally runs on `http://localhost:3000`.

For local development, `/api/` requests must be routed to the backend on port 5001 using a development proxy or equivalent configuration.

To create a production build:

```bash
npm run build
```

The compiled application is generated in `frontend/build/`.

## 4. Architecture Summary

PulseFest follows a client–server architecture consisting of three main components:

**Frontend — React**

Provides the interface for registration, login, festival browsing, ticket reservations, booking confirmations and organiser management.

**Backend — Node.js and Express**

Provides REST API endpoints for authentication, festival management and ticket reservations. Protected endpoints require authentication, and organiser functionality uses role-based access restrictions.

**Database — MongoDB Atlas**

Stores application information such as user accounts, festival details and reservations.

### Deployment Architecture

```text
User's Web Browser
        |
        v
   AWS EC2 Instance
        |
        v
  Nginx (Port 80)
        |
        +------------------------+
        |                        |
        v                        v
 React Frontend             /api/ Requests
 (Static Build)                  |
                                 v
                         Express Backend
                           (Port 5001)
                                 |
                                 v
                           MongoDB Atlas
```

Nginx serves the React production build and forwards `/api/` requests to the Express backend. PM2 manages the backend process.

## 5. Main Features

**Attendee**
- Register and log in
- Browse festivals
- Reserve tickets
- View booking confirmations
- Manage profile information

**Organiser**
- Access the organiser dashboard
- Create festivals
- Update ticket capacities
- Manage festival information

## 6. Known Limitations

- **HTTP deployment:** The current EC2 deployment does not yet provide HTTPS, so real login credentials should not be entered over the public connection.
- **Payment processing:** Ticket reservations do not include online payment processing.
- **Booking notifications:** Email confirmations are not implemented; booking details are presented within the application.
- **Deployment availability:** The university-hosted EC2 instance may not remain available after the assessment period.
- **Development configuration:** Local frontend development requires an API proxy or equivalent configuration for the Express backend.

## 7. Testing

Frontend tests can be run with:

```bash
cd frontend
npm test
```

The application should also be manually tested using attendee and organiser accounts to verify authentication, ticket reservations, event creation and capacity updates.

## 8. Project Documentation

The supporting assignment documentation includes Jira backlog items, SysML design diagrams, Figma wireframes/prototype, GitHub implementation history, deployment evidence and a requirements traceability matrix.

**Figma prototype:** [Insert view-only link]

**Requirements traceability matrix:** [Insert location or link]

---

*PulseFest — IFQ636 Software Lifecycle Management Project*
