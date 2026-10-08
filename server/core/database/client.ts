import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "../../../src/prisma/contract.d";
import contractJson from "../../../src/prisma/contract.json" with {
  type: "json",
};
import { getDatabaseUrl } from "./database-url";

function createDatabaseClient() {
  return postgres<Contract>({
    contractJson,
    url: getDatabaseUrl(),
  });
}

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

const globalForDatabase = globalThis as typeof globalThis & {
  apparelDatabaseClient?: DatabaseClient;
};

export const db =
  globalForDatabase.apparelDatabaseClient ?? createDatabaseClient();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.apparelDatabaseClient = db;
}
