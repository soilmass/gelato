# Server-only libraries (must not land in a client bundle)

If any of these appear in a client chunk, `bundle-budget` flags it as `server-only-leaked-to-client`. This is always a bundler bug or an accidental import boundary crossing — never intentional.

## Database drivers

- `@prisma/client`
- `drizzle-orm` runtime (fine for the schema types, the query runtime must not ship)
- `pg`, `pg-native`, `pg-pool`
- `mysql`, `mysql2`
- `sqlite3`, `better-sqlite3`
- `mongodb`, `mongoose`
- `redis`, `ioredis`

## Crypto / password hashing

- `bcrypt`, `bcryptjs`
- `argon2`
- `scrypt` (Node built-in — `node:crypto` should not be in a client bundle)

## File system / image processing

- `sharp`
- `node:fs`, `node:path`, `node:os`, `node:child_process`
- `fs-extra`, `rimraf`
- `archiver`, `unzipper`

## Email / messaging

- `nodemailer`
- `postmark`, `sendgrid` (their server SDKs — the public SMS or email-send URL can be called from the client but the Node SDK cannot)

## Auth (server-side half)

- `next-auth/jwt` (server decoding)
- `@auth/prisma-adapter` (the DB adapter)

## How to detect

Open the analyzer HTML after `ANALYZE=true bun run build`. Look for any of the above names in **any** client chunk. If present:

1. Identify the file importing it.
2. Check if that file is a `'use client'` component or is imported (directly or transitively) by one.
3. Move the import behind a Server Action / route handler.

## Why this matters beyond bytes

These libraries often also contain credentials code paths (`pg` holds the connection string; `bcrypt` holds a salt pepper; `nodemailer` holds SMTP creds). Leaking any of them to the client is both a performance bug and a potential security one.
