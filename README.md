# Medcore HMS — Hospital Management System

Medcore HMS is a full-stack, multi-hospital management platform for coordinating hospital operations and patient care. It provides role-based workspaces for platform administrators, hospital teams, clinicians, and patients.

## Live application

- **Frontend:** https://medcore-frontend-7uhi.vercel.app/
- **Backend API:** https://medcore-api.duckdns.org
- **Interactive API documentation:** `/api/docs` on the backend (available after the Swagger-enabled backend is deployed)
- **Frontend source:** https://github.com/vishnu11006271/medcore-frontend
- **Backend source:** https://github.com/vishnu11006271/medcore-backend

> The production URLs point to the deployed application. Local development instructions below use local services and credentials. Do not use real patient information in development or screenshots.

## Product capabilities

### Identity, access, and hospital onboarding
- Email registration and OTP-based email verification.
- Login with short-lived JWT access tokens and a rotating, HttpOnly refresh-token cookie.
- Session refresh and logout.
- Role-based access control and account activation checks.
- Public hospital registration request, followed by Super Admin hospital verification or rejection.

### Hospital operations
- Hospital, department, doctor, and staff administration.
- Doctor weekly availability and patient-facing appointment slot lookup.
- Appointment booking and status workflow.
- Hospital dashboard overview, appointment management, and patient views.
- In-app notifications with unread counts and mark-read actions.

### Clinical workflows
- Medical records, record finalization, and vital signs.
- Patient allergy records.
- Prescription creation, patient prescription history, medicine search, and PDF export.
- Laboratory test catalogue, lab orders, sample collection, processing, result upload, and doctor approval.
- Patient access to approved laboratory results.

### Pharmacy and billing
- Medicine catalogue, stock receiving, batches, prescription dispensing, and dispensing history.
- Invoice creation, issue, payment recording, balance and payment history.
- Razorpay order creation, payment verification, and signed webhook processing.
- Invoice PDF generation.

### Dashboards and analytics
- Role-specific dashboard experiences.
- Hospital operational metrics and appointment status insights.
- Platform-level analytics for Super Admin users.

## Roles

The backend defines the following roles:

| Role | Typical access |
|---|---|
| `SUPER_ADMIN` | Platform administration, hospital verification, users, and platform analytics |
| `HOSPITAL_ADMIN` | Hospital configuration, departments, doctors, staff, operational dashboards, billing, lab, and pharmacy administration |
| `DOCTOR` | Assigned appointments, patient clinical details, medical records, prescriptions, lab orders, and result approval |
| `NURSE` | Permitted hospital and laboratory workflows |
| `RECEPTIONIST` | Appointment administration and billing workflows |
| `LAB_TECHNICIAN` | Lab orders, sample collection, processing, and result upload |
| `PHARMACIST` | Medicine stock, prescription dispensing, and dispensing history |
| `ACCOUNTANT` | Invoice and payment workflows |
| `PATIENT` | Own appointments, medical history, prescriptions, approved lab results, and appointment booking |

Access is enforced by backend guards and resource ownership checks. The table is a high-level guide; endpoint-level authorization is defined in the controllers and Swagger documentation.

## Architecture and technology

### Frontend
- Angular 22, TypeScript, RxJS
- Standalone components and lazy-loaded routes
- Route authentication and role guards
- HTTP services/interceptors for API access and session refresh
- Responsive dashboard and operational screens

### Backend
- Node.js 24+ and NestJS 12
- TypeScript, Passport, JWT, class-validator, and class-transformer
- Prisma ORM 7 with PostgreSQL 16
- Nodemailer for verification email
- Razorpay for online payment processing
- PDFKit for invoice PDFs
- Swagger / OpenAPI for API reference

### Local infrastructure
- Docker Compose provisions PostgreSQL 16 and Redis 7.
- PostgreSQL is the configured persistence layer. Redis is included in the local Compose environment for infrastructure needs but is not required by the currently documented application flows.

## Repository layout

This repository contains the NestJS API:

```text
medcore-backend/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── src/
│   ├── appointments/
│   ├── auth/
│   ├── availability/
│   ├── billing/
│   ├── common/
│   ├── departments/
│   ├── doctors/
│   ├── hospital-dashboard/
│   ├── hospitals/
│   ├── laboratory/
│   ├── medical-records/
│   ├── notifications/
│   ├── patient-allergies/
│   ├── pharmacy/
│   ├── platform-analytics/
│   ├── prescriptions/
│   ├── prisma/
│   ├── staff/
│   └── users/
├── test/
├── docker-compose.yml
├── prisma7.config.ts
└── package.json
```

## Prerequisites

- Node.js 24 LTS/current (NestJS 12 requires Node.js 20.19+ or 22.12+).
- npm 11.
- Docker Desktop with Docker Compose.
- Git.
- PostgreSQL is started by Docker Compose for local development.

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/vishnu11006271/medcore-backend.git
cd medcore-backend
npm install
```

### 2. Configure environment

Create your local environment file:

```bash
cp .env.example .env
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

Set strong, unique secrets and your own SMTP/payment credentials. Never commit `.env`.

### 3. Start local infrastructure

```bash
docker compose up -d
docker compose ps
```

The local PostgreSQL service is exposed on port `5432`. The Compose file currently uses the following development database:

- Database: `medcore_hms`
- User: `medcore`
- Password: `local_dev_password`

Change these values in both `docker-compose.yml` and `DATABASE_URL` if you choose different local credentials.

### 4. Generate Prisma Client and apply migrations

```bash
npx prisma generate
npx prisma migrate dev
```

For an environment that should only apply committed migrations:

```bash
npx prisma migrate deploy
```

### 5. Start the API

```bash
npm run start:dev
```

The API listens on `http://localhost:3000` by default (or the configured `PORT`).

### 6. Open API documentation

After the Swagger integration is installed and the API is running:

- Swagger UI: http://localhost:3000/api/docs
- OpenAPI JSON: http://localhost:3000/api/docs-json

Use the **Authorize** control in Swagger UI and provide the JWT access token as a Bearer token for protected endpoints. Login and refresh-token operations use the HttpOnly `medcore_refresh` cookie; JavaScript cannot read that cookie.

## Environment variables

See [`.env.example`](./.env.example) for the complete template.

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Runtime environment (`development` or `production`) |
| `PORT` | HTTP port; defaults to `3000` |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma |
| `JWT_ACCESS_SECRET` | Secret used to sign and verify access JWTs |
| `REFRESH_TOKEN_EXPIRES_DAYS` | Refresh-token lifetime in days; defaults to 7 |
| `FRONTEND_URL` | Frontend URL used in verification email links |
| `CORS_ORIGINS` | Comma-separated list of allowed browser origins |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE` | SMTP server configuration |
| `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` | SMTP credentials and sender identity |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay API credentials |
| `RAZORPAY_WEBHOOK_SECRET` | Secret used to verify Razorpay webhook signatures |
| `SWAGGER_ENABLED` | Set to `false` to disable Swagger UI and its JSON document endpoint |

Do not put secrets in Angular environment files or expose payment secrets to the browser.

## API conventions

Most feature endpoints return a success envelope:

```json
{
  "success": true,
  "data": {},
  "message": "Request completed successfully"
}
```

Errors are normalized by the global exception filter:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A human-readable explanation"
  }
}
```

Some file-stream or domain-specific endpoints return their documented binary or service response directly. Check the Swagger operation response for the exact endpoint contract.

### Authentication flow

1. Register a patient or submit a hospital registration request.
2. Verify the email using the OTP delivered to the registered address.
3. Log in with email and password.
4. The API returns a short-lived access token and sets a rotating refresh token in an HttpOnly cookie named `medcore_refresh`.
5. Send the access token in the `Authorization: Bearer <token>` header.
6. When the access token expires, call `POST /auth/refresh` with credentials enabled; the browser sends the refresh cookie automatically.
7. Call `POST /auth/logout` to revoke the refresh session and clear the cookie.

The access token lifetime is 15 minutes. The refresh token lifetime defaults to 7 days and can be configured with `REFRESH_TOKEN_EXPIRES_DAYS`.

## API modules

The API is organized around these controller groups:

- `/auth` — registration, email verification, login, refresh, logout, and profile.
- `/hospitals`, `/departments`, `/doctors`, `/staff`, `/users` — platform and hospital administration.
- `/doctors/:doctorId/availability` — weekly doctor availability and appointment slots.
- `/appointments` — booking, patient/doctor views, and appointment status transitions.
- `/hospital-dashboard`, `/platform-analytics` — dashboards and reporting.
- `/medical-records`, `/patient-allergies`, `/prescriptions` — clinical records.
- `/lab` — laboratory tests, orders, and result workflow.
- `/pharmacy` — medicine catalogue, stock, and dispensing.
- `/billing` — invoices, payments, Razorpay integration, and invoice PDFs.
- `/notifications` — user notifications.

The Swagger document is generated from the live NestJS controller metadata and DTO validation decorators. Treat it as the endpoint-level source of truth.

## Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start NestJS in watch mode |
| `npm run build` | Compile the backend |
| `npm run start:prod` | Run the compiled API |
| `npm test` | Run unit tests with Vitest |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run test:cov` | Run tests with coverage |
| `npm run lint` | Run Oxlint |
| `npm run format` | Format TypeScript source and tests |

## Production deployment notes

The current deployment uses an HTTPS API endpoint and an Angular frontend hosted separately. For a production deployment:

1. Configure production PostgreSQL and a strong `JWT_ACCESS_SECRET`.
2. Set SMTP and Razorpay credentials through the hosting provider's secret/environment configuration.
3. Set `FRONTEND_URL` and `CORS_ORIGINS` to the exact deployed frontend origin(s).
4. Use HTTPS and keep the refresh cookie `Secure` and `HttpOnly`; production cookie SameSite configuration is `None`.
5. Run `npx prisma migrate deploy` before starting a new application version.
6. Build with `npm run build` and start with `npm run start:prod`.
7. Keep database backups, restrict database network access, rotate credentials, and monitor application logs.
8. Disable public Swagger endpoints with `SWAGGER_ENABLED=false` if API discovery should not be exposed in production.

This project handles sensitive health-related information. A production launch requires a separate security, privacy, backup/restore, access-control, and regulatory review. The presence of authentication and role checks alone does not establish healthcare regulatory compliance.

## Related documentation

- [Frontend repository](https://github.com/vishnu11006271/medcore-frontend)
- [Backend repository](https://github.com/vishnu11006271/medcore-backend)
- [NestJS documentation](https://docs.nestjs.com/)
- [Prisma documentation](https://www.prisma.io/docs)
- [OpenAPI specification](https://spec.openapis.org/oas/latest.html)

## License

No open-source license is currently declared for this repository. Contact the project owner before redistributing or reusing the code.
