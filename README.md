# Insyd Notifications -- System Design (POC → Scale)

## 1) Goals & Scope

**What**: Notify users about activity on Insyd (new posts, likes,
comments, follows, jobs, mentions).\
**Who**: Followers of an actor, content owners, @mentioned users.

**POC constraints**: Keep it simple, minimal infra cost, easy to demo.\
**Non-goals (POC)**: Real auth, push to mobile, complex preference
center, aggressive optimization.

------------------------------------------------------------------------

## 2) High-Level Architecture

    ┌───────────────┐         ┌────────────────────┐
    │ React Client  │  HTTP   │  Node/Express API  │
    │  (Vite)       ├────────▶│  (server)          │
    └─────▲─────────┘         └───────┬────────────┘
          │ Poll / Fetch                       │
          │ /notifications?userId=alice        │
          │                                    ▼
          │                          ┌─────────────────┐
          │                          │ MongoDB (Mongoose)
          │                          │  - posts         │
          │                          │  - notifications │
          │                          └─────────────────┘
          │
          └── (later) WS/SSE for realtime push

POC uses HTTP polling from client → API → MongoDB.\
Path to scale adds eventing + fan-out workers + push channels.

------------------------------------------------------------------------

## 3) Key Concepts & Data Model

**Entities (POC):**\
**Post** - content: string\
- userId: string (author)\
- createdAt: Date

**Notification** - userId: string (receiver)\
- type: "post" \| "like" \| "comment" \| "other"\
- actorId: string (who caused it)\
- entity: { kind: "post" \| "comment" \| "user", id: string }\
- title: string\
- body?: string\
- status: "unread" \| "read"\
- createdAt: Date

**MongoDB Indexes**\
- notifications: { userId: 1, createdAt: -1 }\
- notifications: { userId: 1, status: 1, createdAt: -1 }\
- (optional later) TTL or archival policy for old notifications.

------------------------------------------------------------------------

## 4) Notification Flows (POC)

**A) Create Post → Notify Followers (simulated fan-out)**\
- Client: `POST /posts { userId, content }`\
- API: create post.\
- API: fan-out notifications to demo "followers" (fixed list excluding
author).\
- Clients poll `/notifications?userId=<me>` and see new items.

**B) Like Post → Notify Author**\
- Client: `POST /posts/:id/like { actorId }`\
- API: find post; if liker ≠ author → create like notification.\
- Author sees notification on next poll.

Delivery in POC: polling every N ms (configurable).\
Read state: mark single or mark-all as read.

------------------------------------------------------------------------

## 5) API Surface (POC)

-   `POST /posts` → create a post\
-   `GET /posts` → list posts (newest first)\
-   `POST /posts/:id/like` → like (creates notif to author)\
-   `GET /notifications?userId=...&limit=...` → list notifs\
-   `PATCH /notifications/:id/read` → mark 1 read\
-   `PATCH /notifications/read-all?userId=...` → mark all read

All routes expect JSON; CORS enabled.

------------------------------------------------------------------------

## 6) Client Behavior (POC)

-   Switch Current user (alice/bob/carol/dave).\
-   Create posts, like posts.\
-   Notifications Sidebar: unread count, mark single/mark all, poll
    interval control.

------------------------------------------------------------------------

## 7) Scaling Plan (100 DAU → 1M DAU)

-   Event ingestion & fan-out pipeline (Kafka/SQS/etc.)\
-   Write-time fan-out preferred for notifications.\
-   MongoDB sharding by userId.\
-   WebSocket/SSE for realtime.\
-   Push/email channels.\
-   Preferences & mute options.\
-   Observability & retries with idempotency.

------------------------------------------------------------------------

## 8) Performance Considerations

-   Indexed reads (userId, createdAt desc).\
-   Bulk inserts for fan-out.\
-   Compact payloads.\
-   Retry on cold starts.\
-   Rate limiting later.

------------------------------------------------------------------------

## 9) Reliability & Failure Modes

-   DB failures → retry.\
-   Partial fan-out → DLQ + retry.\
-   Polling gaps → catch-up by timestamp.\
-   Queue failures → degrade to direct writes.

------------------------------------------------------------------------

## 10) Security & Privacy (essentials)

-   POC has no auth.\
-   Production: JWT/OAuth, input validation, row-level access control.\
-   Encrypt secrets, rate-limit endpoints.

------------------------------------------------------------------------

## 11) Cost & Footprint (POC)

-   MongoDB Atlas free tier.\
-   Render free backend.\
-   Vercel hobby frontend.

------------------------------------------------------------------------

## 12) What the POC Implements (Exactly)

-   Types: post, like.\
-   Demo users: alice, bob, carol, dave.\
-   Fan-out: synchronous insertMany.\
-   Delivery: polling.\
-   Mark single/mark all read.\
-   Indexed reads.

------------------------------------------------------------------------

## 13) How to Run (Dev)

**Server**

    .env: MONGO_URI=mongodb://127.0.0.1:27017/insyd_poc
    npm install && npm run dev

**Client**

    .env: VITE_API_URL=http://localhost:5000
    npm install && npm run dev

------------------------------------------------------------------------

## 14) How We'll Evolve to Production

-   Replace polling with SSE/WebSockets.\
-   Add followers graph & real audience resolution.\
-   Add preferences (per type/channel), digest emails.\
-   Add brokers (Kafka/SQS) for fan-out.\
-   Shard notifications, archive old data.\
-   Add auth, observability, dashboards.

------------------------------------------------------------------------

## 15) Limitations (POC)

-   No auth; userId is client-supplied.\
-   Followers are simulated.\
-   Polling causes slight delays.\
-   No retries or async pipelines.

------------------------------------------------------------------------

## 16) API Examples

    POST /posts
    Content-Type: application/json
    { "userId": "alice", "content": "First post!" }

    GET /notifications?userId=alice&limit=50

    PATCH /notifications/{id}/read

    PATCH /notifications/read-all?userId=alice

------------------------------------------------------------------------

## 17) Glossary

-   **Actor**: user who performed the action.\
-   **Receiver**: user who gets the notification.\
-   **Fan-out**: per-user notification entries for recipients.\
-   **SSE**: Server-Sent Events.\
-   **WS**: WebSocket.

------------------------------------------------------------------------

## TL;DR

POC: MongoDB + Express + React polling, write-time fan-out (simple),
mark-read, indexed reads.\
Scale: event pipeline + workers + WS/SSE + preferences + shard/archival.
