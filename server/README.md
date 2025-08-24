# Insyd Notify Server

Express + MongoDB server for posts and notifications (POC).

## Setup
1) `cp .env.example .env` and set `MONGO_URI`
2) `npm install`
3) `npm run dev`

## Endpoints
- POST /posts               { userId, content }
- GET  /posts
- POST /posts/:id/like      { actorId }
- GET  /notifications?userId=alice
- PATCH /notifications/:id/read
- PATCH /notifications/read-all?userId=alice