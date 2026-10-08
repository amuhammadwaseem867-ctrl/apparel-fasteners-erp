# Prisma 8 foundation

The project uses the Prisma 8 contract-based ORM setup. The schema contract is
`src/prisma/contract.prisma`, the CLI configuration is `prisma.config.ts`, and
the shared database client is `server/core/database/client.ts` (re-exported
from `src/prisma/db.ts` for compatibility).

The contract is intentionally empty during Phase A. ERP entities and database
migrations must be added only after their domain relationships and lifecycles
have been designed. Do not use demo models or apply migrations to a production
database during foundation work.

## Environment

Set `DATABASE_URL` to a PostgreSQL connection string in the local environment
or Vercel project settings. `.env.example` documents required and reserved
variables without containing credentials. The application validates the URL
when the database client is first initialized; it does not connect during
contract generation or build.

## Contract workflow

```bash
npx prisma contract emit
npx prisma migration plan
npx prisma migration status
```

Contract generation is offline. Review the planned migration carefully and
apply it only when the corresponding domain schema is ready and the target
database has been explicitly selected.
