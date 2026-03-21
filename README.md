# Cricket Auction HQ

Real-time cricket auction and snake draft platform built with Next.js, TypeScript, PostgreSQL, Prisma, and Socket.IO.

This app is designed for private leagues that want:
- an admin control room for setup, launch, and live interventions
- invite-based team owner onboarding
- realtime auction and snake-draft views for team owners
- roster rules, timers, logs, and history in one deployment

## What This App Does

The product supports a two-phase player allocation flow:
- a bidding phase where owners nominate players and place bids
- a snake draft phase that begins after the configured bidding quota is reached

The server is the source of truth for:
- auction phase and turn state
- timer deadlines and timeout resolution
- accepted bids and pass state
- roster legality
- audit logging
- live snapshots broadcast to connected clients

## Feature Overview

### Authentication and roles

- Admin login with protected admin routes
- Team-owner login with protected owner routes
- Session-backed auth stored in the database
- Logout endpoints for admin and owner users
- Role-based route and API protection

### Team owner onboarding

- Invite-only onboarding flow
- One team-bound invite per owner
- Invite redemption creates the owner account and links it to the team
- Existing pending invite for a team is revoked when a new invite is created
- Invite lifecycle handling for pending, redeemed, expired, and revoked invites

### Admin setup and league management

- Setup checklist showing whether the auction is ready to start
- Team creation, editing, and deletion
- Team owner password reset
- Player creation
- Ranking CSV import
- Auction rules and timer configuration
- New auction season creation
- Admin reset tools for current auction, live progress, or full reseed

### Auction engine

- Randomized owner nomination order when the auction starts
- Bidding nomination turn before each bidding round
- Bidding rounds with:
  - accepted bids only if higher than the current highest bid
  - accepted bid amounts unique within the round
  - per-team bidding win limit of 3
  - pass support once a bid exists
  - timer reset after each valid bid
  - instant win at `5000`
- Manual review and intervention support when a round cannot auto-resolve cleanly
- Reopen bidding round support for admins
- Automatic transition from bidding phase to snake draft
- Snake draft order derived from bidding results
- Automatic snake pick on timeout using highest-ranked valid remaining player
- Auction completion detection when rosters are filled

### Roster and rules enforcement

- Configurable roster size
- Configurable min/max counts for:
  - batsmen
  - bowlers
  - all-rounders
  - wicketkeepers
- Validation before assigning a player to a team
- Invalid pick attempts logged in the audit trail

### Live owner experience

- Realtime auction snapshots over Socket.IO
- Connection-state awareness in the UI
- Live countdown timers
- Bid panel with quick feedback
- Nomination and pick board filtered by search, role, and IPL team
- Team summary and leaderboard views
- Activity feed and order board
- Confetti and sound effects for owner-side milestones
- Owner-focused auction view and snake-draft view

### Admin live operations

- Start, pause, and resume auction controls
- Resolve timed-out pick / nomination cases
- Undo last admin intervention
- Correct the last pick
- Audit log viewer
- Historical auction list and auction history detail page

### Realtime and observability

- WebSocket join/leave flow tied to auction rooms
- Realtime connection persistence in PostgreSQL
- Owner connected / disconnected audit events
- Snapshot refresh on reconnect, focus restore, and visibility recovery

## Tech Stack

- Next.js App Router
- React 19
- TypeScript
- PostgreSQL
- Prisma ORM
- Socket.IO
- Zod
- Tailwind CSS
- `tsx` for the custom Node server and scripts

## Environment Variables

### Runtime variables

| Variable | Required | Purpose | Example |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma and the app server | `postgresql://postgres:postgres@localhost:5432/cricket_auction` |
| `APP_URL` | Yes | Public origin used for invite URLs, redirect construction, and production origin handling | `http://localhost:3000` |
| `PORT` | No | HTTP port for the custom server | `3000` |

### Admin / seed defaults

| Variable | Required | Purpose | Example |
| --- | --- | --- | --- |
| `ADMIN_EMAIL` | Recommended | Default admin email used by seed and surfaced in admin pages that build invite URLs | `admin@auction.local` |
| `ADMIN_PASSWORD` | Recommended | Default admin password used by seed and current server-side env validation paths | `AdminPass123!` |
| `SEED_OWNER_PASSWORD` | No | Reserved for custom seed/reset flows | `OwnerPass123!` |

Note:
- `.env.example` is the best starting point for local setup.
- The current `getEnv()` schema includes `ADMIN_EMAIL` and `ADMIN_PASSWORD`, and admin pages such as invite/setup pages call it server-side. In practice, it is safest to provide both values in all environments today.

Example local `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cricket_auction"
APP_URL="http://localhost:3000"
PORT="3000"
ADMIN_EMAIL="admin@auction.local"
ADMIN_PASSWORD="AdminPass123!"
SEED_OWNER_PASSWORD="OwnerPass123!"
```

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Create your env file

Copy `.env.example` to `.env` and adjust values if needed.

### 3. Start PostgreSQL

If PostgreSQL is already installed locally, make sure the database exists and is reachable.

Example on macOS with Homebrew:

```bash
brew install postgresql@15
brew services start postgresql@15
createdb cricket_auction
```

If you want Docker for the database only:

```bash
npm run db:start
```

The included [`docker-compose.yml`](/Users/nagavadlamudi/Downloads/projects/cricket-auction-webapp/docker-compose.yml) starts PostgreSQL 15 on `localhost:5432` with:
- database: `cricket_auction`
- user: `postgres`
- password: `postgres`

### 4. Generate Prisma client and apply schema

```bash
npm run db:generate
npm run db:push
```

For a migration-based local workflow, you can also use:

```bash
npm run db:migrate
```

### 5. Seed demo data

```bash
npm run db:seed
npm run db:seed:players
```

### 6. Run the app

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Useful Scripts

Application:

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run test
```

Database and seed helpers:

```bash
npm run db:start
npm run db:stop
npm run db:reset
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:seed
npm run db:reseed
```

What they do:
- `db:start`: starts the local PostgreSQL container
- `db:stop`: stops the local PostgreSQL container
- `db:reset`: removes the Docker PostgreSQL volume
- `db:generate`: regenerates Prisma Client
- `db:push`: pushes the schema directly to the configured database
- `db:migrate`: creates and applies a Prisma development migration
- `db:seed`: clears app data and loads demo data
- `db:seed:players`: replaces only the player pool and auction data while preserving teams, owner accounts, invites, and sessions
- `db:reseed`: Prisma migration reset followed by seed

## Seed Data

The seed flow clears application data and creates:
- 1 admin account
- 10 teams
- 10 pending invite links, one per team
- 1 ready auction
- player records loaded from `prisma/seed-data/players.csv`
- auction-player links for the current auction

### Default seed values

If you use `.env.example` as-is, the seeded admin login will be:

```text
email: admin@auction.local
password: AdminPass123!
```

Code-level fallback defaults in `src/server/admin/reset-service.ts` are:
- email defaults to `admin@auction.local` unless `ADMIN_EMAIL` is set
- password defaults to `change-me` unless `ADMIN_PASSWORD` is set

### Seeded teams

- Sunrisers (`SR`)
- Mafia (`MF`)
- Karanam Killers (`KK`)
- Transformers (`TR`)
- Royal Challengers (`RC`)
- Assam Archers (`AA`)
- Team Fighters (`TF`)
- Dine-A-Mites (`DM`)
- Punters (`PT`)
- Naughty Buggers (`NB`)

### Seeded invite links

```text
/invite/seed-invite-sr
/invite/seed-invite-mf
/invite/seed-invite-kk
/invite/seed-invite-tr
/invite/seed-invite-rc
/invite/seed-invite-aa
/invite/seed-invite-tf
/invite/seed-invite-dm
/invite/seed-invite-pt
/invite/seed-invite-nb
```

Seeded owners are not pre-created. Owners complete signup by redeeming their invite.

### Default seeded auction rules

- total teams: `10`
- roster size: `12`
- bidding picks per team: `3`
- bidding timer: `60s`
- nomination timer: `60s`
- snake timer: `60s`
- batsmen: `4..6`
- bowlers: `3..5`
- all-rounders: `2..4`
- wicketkeepers: `1..2`

## Project Structure

```text
prisma/
  schema.prisma
  seed.ts
  seed-data/
src/
  app/
    (public)/
    admin/
    owner/
    api/
  components/
  lib/
  server/
  types/
server.ts
Dockerfile
docker-compose.yml
apprunner.yaml
```

## Architecture Notes

### Custom server

The app runs through [`server.ts`](/Users/nagavadlamudi/Downloads/projects/cricket-auction-webapp/server.ts), not plain `next start`, so HTTP and Socket.IO live in the same Node process.

### Realtime model

- Socket.IO rooms are keyed by auction ID
- Clients receive full auction snapshots
- Clients also force refresh on reconnect, focus regain, and online recovery
- Realtime connection state is stored in the database for audit visibility

### Timer model

- Timer deadlines are stored in PostgreSQL
- The server runs `processExpiredTimers()` every second
- Timeout handling can auto-advance rounds, auto-pick in snake, or move a round into manual review depending on the situation

### Current scaling assumption

This is currently a single-instance MVP.

That matters because:
- Socket.IO broadcasting is process-local today
- timer processing runs inside the app process
- there is no shared Redis pub/sub layer yet

If you want horizontal scaling later, you will need:
- Redis-backed Socket.IO adapter
- shared timer ownership / locking
- coordinated broadcast behavior across app instances

## Docker

The repo includes:
- a [`Dockerfile`](/Users/nagavadlamudi/Downloads/projects/cricket-auction-webapp/Dockerfile) for app images
- a [`docker-compose.yml`](/Users/nagavadlamudi/Downloads/projects/cricket-auction-webapp/docker-compose.yml) for local PostgreSQL

Build the image:

```bash
docker build -t cricket-auction-webapp .
```

Run the app container:

```bash
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/cricket_auction" \
  -e APP_URL="http://localhost:3000" \
  -e ADMIN_EMAIL="admin@auction.local" \
  -e ADMIN_PASSWORD="AdminPass123!" \
  cricket-auction-webapp
```

Note:
- the Dockerfile includes default build-time env values so `docker build` succeeds before real runtime values are injected
- production deployments should still inject real runtime env vars from the platform

## AWS Deployment Guide

### Recommended MVP topology

- App: one AWS App Runner service or one ECS/Fargate service
- Database: Amazon RDS for PostgreSQL
- Image registry: Amazon ECR if you are building/pushing your own container image
- Secrets/config: App Runner or ECS environment variables, ideally sourced from AWS Secrets Manager or SSM Parameter Store

### Why single-instance matters on AWS

For the current codebase, the safest production shape is:
- one app instance
- one PostgreSQL database
- WebSocket support preserved end-to-end

Do not assume this app is ready for multi-instance scaling without adding shared realtime and timer coordination.

### Environment values to configure in AWS

At minimum set:
- `DATABASE_URL`
- `APP_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `PORT=3000`

Use your public HTTPS URL for `APP_URL`, for example:

```env
APP_URL="https://auction.example.com"
DATABASE_URL="postgresql://auction_user:strong-password@your-rds-endpoint.us-west-2.rds.amazonaws.com:5432/cricket_auction?schema=public"
```

### App Runner

This repo includes a starter [`apprunner.yaml`](/Users/nagavadlamudi/Downloads/projects/cricket-auction-webapp/apprunner.yaml).

Current App Runner flow:
- build: `npm ci` then `npm run build`
- run: `npm run start`
- network port: `3000`

When configuring App Runner:
- point it at this repo or a built image
- set all required environment variables / secrets
- make sure the service can reach the RDS instance
- use the App Runner HTTPS domain or your custom domain as `APP_URL`

### ECS / Fargate

If you deploy on ECS instead of App Runner:
- run a single task for the MVP
- expose port `3000`
- preserve WebSocket upgrade support at the load balancer
- use sticky sessions if a load balancer sits in front, even for a conservative rollout

### RDS and networking

- Create a PostgreSQL database on RDS
- Ensure the app can reach the RDS security group on the PostgreSQL port
- Keep database credentials out of the repo
- Prefer Secrets Manager or Parameter Store for connection strings and admin credentials

### Migrations / schema rollout

The app build does not automatically migrate the database at deployment time.

Before serving production traffic, run:

```bash
npm run db:generate
npm run db:push
```

For stricter production change control, prefer managed Prisma migrations over `db:push`.

You can run schema updates from:
- a CI/CD release step
- a one-off admin task or job
- a controlled operator session before cutting traffic over

### WebSocket and proxy requirements

This app uses Socket.IO and expects long-lived connections.

Your AWS setup must allow:
- WebSocket upgrade requests
- long-lived connections without aggressive buffering or interruption
- traffic routing back to the same single app instance for the MVP shape

### Production checklist

- Build image or connect source deployment
- Provision PostgreSQL on RDS
- Apply Prisma schema
- Configure `DATABASE_URL`, `APP_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`
- Point DNS / custom domain if needed
- Verify login, invite generation, live bidding, and socket reconnection behavior

## Product Assumptions and Current Limitations

- One active auction room is the practical operating model today
- The app is optimized for a single primary runtime instance
- Team owners are onboarded via invite redemption rather than pre-created accounts
- Admin intervention is still part of the intended flow for certain timeout and correction scenarios
- Session tokens are stored directly in the database today
- Horizontal scaling and external job coordination are future hardening work, not current behavior

## Verification

Recommended validation before deploying changes:

```bash
npm install
npm run db:generate
npm run test
npm run typecheck
npm run build
```

## License

Add your preferred license before publishing publicly.
