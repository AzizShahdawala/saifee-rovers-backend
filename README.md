# Saifee Rovers backend

Express and MongoDB API for the Saifee Rovers React administration app.

## Setup

1. Copy `.env.example` to `.env` and set MongoDB and administrator credentials.
2. Run `npm install`.
3. Run `npm run dev` (or `npm start`).
4. Set the frontend's `VITE_API_URL` to `http://localhost:5000/api`.

## Face recognition service

The local CPU-only recognition service uses YuNet face detection and SFace embeddings.

Start it in a second terminal before starting attendance scanning:

```powershell
npm run ai
```

Then keep the Node backend running in the first terminal with `npm run dev`. The AI health endpoint is `http://127.0.0.1:8000/health`.

Registration processes the five webcam photos and stores an averaged normalized embedding in MongoDB. Attendance scanning matches that embedding and records attendance against the currently active event. Set an event's status to `Active` before scanning.

## API

- `POST /api/auth/login`
- `GET|POST /api/members`, `GET|PUT|DELETE /api/members/:id`
- `POST /api/members/register` (multipart form with exactly five `images`)
- `GET|POST /api/events`, `GET|PUT|DELETE /api/events/:id`
- `GET /api/attendance`, `POST /api/attendance/manual`
- `PUT|DELETE /api/attendance/:id`
- `POST /api/attendance/recognize` (YuNet/SFace recognition)
- `GET /api/dashboard`
- `GET /api/health`

Attendance has a unique member/event constraint, preventing duplicate check-ins. Deleting a member or event also removes its attendance records.
