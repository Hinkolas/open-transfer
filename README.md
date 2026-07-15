# OpenTransfer

A WeTransfer-style file sharing app: upload a file up to 3 GB, get a link, share it.
Files go **directly from the browser to S3-compatible storage** via presigned URLs —
they never pass through the app server. Postgres holds the metadata.

Built with SvelteKit (Svelte 5, Tailwind v4, adapter-node), Drizzle ORM, and Bun.

## Features

- Single file up to 3 GB, drag-and-drop, with upload progress
- Share link with configurable expiry (1/3/7/30 days or never)
- Optional password protection (scrypt-hashed, rate-limited to 5 attempts / 15 min)
- Downloads via short-lived (5 min) presigned URLs
- Expired and abandoned uploads are cleaned up lazily — no cron required
- Database migrations run automatically at boot

## Configuration

All configuration is read at runtime (`$env/dynamic/private`), so one Docker image
runs anywhere. See `.env.example`.

| Variable               | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`         | Postgres connection string                                        |
| `S3_ENDPOINT`          | S3 endpoint URL; leave empty for AWS S3                           |
| `S3_REGION`            | Bucket region (default `us-east-1`)                               |
| `S3_BUCKET`            | Bucket name                                                       |
| `S3_ACCESS_KEY_ID`     | Access key                                                        |
| `S3_SECRET_ACCESS_KEY` | Secret key                                                        |
| `S3_FORCE_PATH_STYLE`  | `"true"` for MinIO/Garage/most self-hosted providers              |
| `ORIGIN`               | Public URL of the app, e.g. `https://transfer.example.com` (prod) |

> **Pooler note:** if `DATABASE_URL` points at a transaction-mode pooler
> (pgbouncer, supavisor), append `?prepare=false` — postgres.js prepared
> statements don't survive transaction pooling.

### Bucket CORS (required)

Browsers upload straight to the bucket with a presigned `PUT`, so the bucket
**must** answer CORS preflights from the app's origin. Without this, uploads fail
with an opaque network error (status 0).

```json
[
	{
		"AllowedOrigins": ["http://localhost:5173", "https://transfer.example.com"],
		"AllowedMethods": ["PUT"],
		"AllowedHeaders": ["*"],
		"ExposeHeaders": ["ETag"],
		"MaxAgeSeconds": 3600
	}
]
```

The DB user needs schema-create rights on first boot (the migrator keeps its
journal in a `drizzle` schema).

## Development

```sh
bun install
cp .env.example .env   # fill in real Postgres + S3 credentials
bun run dev
```

The dev server starts even without a reachable database (migrations are skipped
with a warning); uploading and downloading need real Postgres + S3 credentials
and bucket CORS that allows `http://localhost:5173`.

Schema changes: edit `src/lib/server/db/schema.ts`, then `bun run db:generate`
and commit the new files in `drizzle/` — they are applied automatically at boot.

## Docker

Images are built by CI and published to GHCR on every push to `main`:

```sh
docker run -p 3000:3000 \
  -e DATABASE_URL="postgres://…" \
  -e S3_ENDPOINT="https://s3.example.com" \
  -e S3_REGION="us-east-1" \
  -e S3_BUCKET="open-transfer" \
  -e S3_ACCESS_KEY_ID="…" \
  -e S3_SECRET_ACCESS_KEY="…" \
  -e S3_FORCE_PATH_STYLE="true" \
  -e ORIGIN="https://transfer.example.com" \
  ghcr.io/hinkolas/open-transfer:latest
```

Or build locally: `docker build -t open-transfer .`

## How a transfer works

1. `POST /api/transfers` validates the metadata, stores a `pending` row, and
   returns a presigned `PUT` URL (valid 6 h).
2. The browser `PUT`s the file straight to the bucket (XHR, with progress).
3. `POST /api/transfers/:id/finalize` verifies the object exists with the
   declared size (`HeadObject`) and flips the row to `ready`.
4. The share page `/t/:id` shows metadata only. `POST /api/transfers/:id/download`
   checks the password if one is set, then returns a 5-minute presigned `GET`
   with `Content-Disposition: attachment`.

Expired transfers answer `410 Gone` and their objects are deleted on access;
`pending` rows older than 24 h are swept whenever a new transfer is created.
