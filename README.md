# Saifee Rovers backend

Express and MongoDB API for the Saifee Rovers administration and member portals.

## Setup

1. Copy `.env.example` to `.env` and set MongoDB and administrator credentials.
2. Run `npm install`.
3. Run `npm run dev` (or `npm start`).
4. Set the frontend's `VITE_API_URL` to `http://localhost:5000/api`.

## Face recognition service

The local CPU-only recognition service uses YuNet face detection and SFace embeddings.

Local development starts both the Node API and recognition service together:

```powershell
npm run dev
```

The recognition health endpoints are `http://127.0.0.1:8000/health` and `http://localhost:5000/api/recognition/health`. Use `npm run dev:api` only when intentionally running the recognition service separately.

Registration processes the five webcam photos and stores an averaged normalized embedding in MongoDB. Attendance scanning matches that embedding and records attendance against the currently active event. Set an event's status to `Active` before scanning.

## API

- `POST /api/auth/login`
- `POST /api/auth/member/request-otp`
- `POST /api/auth/member/set-password`
- `POST /api/auth/member/login`
- `POST /api/auth/password/request-reset`
- `POST /api/auth/password/reset`
- `GET /api/member-portal/me`
- `GET /api/member-portal/dashboard`
- `GET /api/member-portal/attendance`
- `GET /api/member-portal/events`
- `PUT /api/member-portal/me/password`
- `PUT /api/member-portal/me/photo` (multipart `photo`)
- `GET|POST /api/members`, `GET|PUT|DELETE /api/members/:id`
- `POST /api/members/register` (multipart form with exactly five `images`)
- `GET|POST /api/events`, `GET|PUT|DELETE /api/events/:id`
- `GET /api/attendance`, `POST /api/attendance/manual`
- `PUT|DELETE /api/attendance/:id`
- `POST /api/attendance/recognize` (YuNet/SFace recognition)
- `GET /api/dashboard`
- `GET /api/health`

Attendance has a unique member/event constraint, preventing duplicate check-ins. Deleting a member or event also removes its attendance records.

Member patrols are restricted to Fox, Dove, Bull, and Peacock. Run `npm run migrate:patrols` after upgrading an existing database; the migration normalizes patrol values, initializes `isPatrolLeader`, and creates the one-active-leader-per-patrol index.

Member portal endpoints require a member JWT. First-time member activation and both admin/member password resets use six-digit email codes. Codes are never returned by the API.

Email delivery uses Gmail through Nodemailer. Set `SMTP_PASSWORD` to the Google app password for `azizshada@gmail.com` (not the normal Gmail password). Spaces in an app password are accepted and normalized. In local development without that credential, Nodemailer's stream transport writes the generated email to the backend terminal for testing; production refuses to generate an OTP when delivery is unavailable.
