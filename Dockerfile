FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.18.1 --activate

COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3001

CMD ["pnpm", "run", "start:dev"]
