This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### CI/CD (Auto deploy to VPS Docker from `main`)

This repository includes GitHub Actions workflow:

- `.github/workflows/deploy-vps.yml`

When code is pushed to `main`, it will:

1. Install dependencies
2. Run lint and build
3. Build Docker image
4. Push image to GHCR
5. SSH into VPS and deploy with Docker Compose (`pull` + `up -d`)

#### Required GitHub Secrets

- `VPS_HOST`: IP/domain VPS
- `VPS_USER`: SSH user
- `VPS_SSH_KEY`: private key (PEM/OpenSSH format)
- `VPS_PORT`: SSH port (usually `22`)

#### One-time setup on VPS

```bash
mkdir -p /root/rockpit
cp .env.example /root/rockpit/.env.production
# edit /root/rockpit/.env.production with production values
```

#### Production env notes (`.env.production`)

- `NEXTAUTH_URL` should be your public HTTPS domain (example: `https://rockpit.tc8studio.com`).
- If PostgreSQL is running on the VPS host (or another container published on host port), do not use `localhost` from inside app container.
- Use host gateway name with this compose setup:

```env
DATABASE_URL="postgresql://<user>:<password>@host.docker.internal:5432/personal_journal?schema=public"
```

#### Applying Prisma migrations in production

Run this after the container is up (first deploy and every schema change):

```bash
cd /root/rockpit
docker compose -f docker-compose.prod.yml exec rockpit npx prisma migrate deploy --schema=./prisma/schema.prisma
```
