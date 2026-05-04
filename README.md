# ChatApp

A production-grade real-time messaging application built with React, Node.js, PostgreSQL, and Redis. Supports direct messages, group chats, typing indicators, read receipts, reactions, and file sharing.

**Live demo:** `https://chat-app-gray-three-37.vercel.app/` | Test with `alice@demo.com / password123`

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | React 18 + Vite | Fast HMR, small bundle, concurrent rendering |
| **Styling** | Tailwind CSS | Design tokens without fighting CSS specificity |
| **State** | Zustand + React Query | Zustand for UI state, React Query for server cache |
| **Realtime** | Socket.io | WebSocket with automatic polling fallback |
| **Backend** | Node.js + Express | Lightweight, large ecosystem, same language as frontend |
| **Database** | PostgreSQL + Prisma | ACID guarantees, Prisma's type-safe query builder |
| **Cache / Pub-sub** | Redis (ioredis) | Online presence + Socket.io multi-node adapter |
| **Auth** | JWT (access + refresh) | Stateless auth with rotation for security |

---

## Local Setup

```bash
# 1. Clone and install
git clone <repo-url> && cd chat-app
cd server && npm install
cd ../client && npm install

# 2. Configure environment
cp server/.env.example server/.env   # edit DATABASE_URL, REDIS_URL, JWT secrets

# 3. Push schema and seed
cd server && npm run db:push && npm run db:seed

# 4. Start both servers
npm run dev          # from /server
npm run dev          # from /client (new terminal)
```

App runs at `http://localhost:5173`. API at `http://localhost:5000`.

---

## Technical Decisions

### Cursor pagination instead of offset

Offset pagination breaks under concurrent writes: if 5 messages arrive while a user pages through history, every subsequent page is shifted by 5 rows. Cursor pagination uses the `created_at` timestamp of the oldest loaded message as the next page token — this is stable regardless of inserts. The tradeoff is that you can't jump to "page 12" arbitrarily, but for a chat app this is the right call since users always scroll linearly upward.

### Redis for presence instead of an in-memory Map

An in-memory `Map` inside a single Node process works fine in development, but breaks the moment you run more than one server instance. If Alice connects to Pod A and Bob connects to Pod B, Pod B has no knowledge of Alice being online. Redis is a shared, external store that all pods read and write, so presence state is consistent across the entire cluster. The cost is a network hop per presence check, which is acceptable given how infrequently it changes.

### JWT refresh token rotation

A standard access token (15 min lifetime) limits the damage window if a token is stolen — the attacker's access expires soon. But short-lived tokens would require frequent re-logins. Refresh tokens (7-day lifetime) solve this, but create a new problem: a stolen refresh token grants long-lived access. Rotation mitigates this: each time a refresh token is used, a new one is issued and the old one is invalidated. If someone tries to reuse a spent refresh token, we detect it as a potential theft and invalidate the entire session — forcing a fresh login.

---

## Project Structure

```
chat-app/
├── server/              # Express API + Socket.io
│   ├── config/          # DB, Redis, Cloudinary singletons
│   ├── controllers/     # Route handlers (one file per domain)
│   ├── middleware/       # Auth, rate limiting, file upload
│   ├── routes/          # Express routers
│   ├── sockets/         # Socket.io init, event handlers, presence
│   └── prisma/          # Schema + seed data
└── client/              # React SPA
    └── src/
        ├── api/         # Axios instance + per-domain API functions
        ├── context/     # Auth + Socket React contexts
        ├── hooks/       # useMessages, useTyping, usePresence
        ├── store/       # Zustand global state
        ├── components/  # UI components
        └── pages/       # Route-level components
```

---

## Features

- **Real-time messaging** over WebSocket with Socket.io
- **Typing indicators** with auto-timeout after 3 seconds of inactivity
- **Read receipts** — single ✓ sent, double ✓✓ delivered, blue ✓✓ seen
- **Message reactions** — toggle emoji reactions on any message
- **Reply to messages** — quoted preview above bubble
- **Edit & delete messages** (soft delete, shows "Message deleted")
- **Infinite scroll** with cursor-based pagination
- **File sharing** — images and PDFs via Cloudinary
- **Online presence** — green dot with pulse animation
- **Group chats** with admin roles
- **Message search** within a conversation
- **Password strength indicator** on registration
- **Reconnect banner** on socket disconnect
- **Skeleton loading states** — no spinners
- **Persistent active chat** across page refreshes via localStorage
- **Unread count badge** on sidebar + document title
