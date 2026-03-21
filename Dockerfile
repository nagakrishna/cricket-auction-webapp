FROM node:20-bookworm-slim

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

# Default build-time values so `docker build` works before real secrets are injected.
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cricket_auction
ENV APP_URL=http://localhost:3000
ENV ADMIN_EMAIL=admin@auction.local
ENV ADMIN_PASSWORD=AdminPass123!
ENV SEED_OWNER_PASSWORD=OwnerPass123!

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "run", "start"]
