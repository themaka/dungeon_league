import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://dungeon:league@localhost:5432/dungeon_league?schema=public";

let prisma: PrismaClient;

declare global {
  var __db__: PrismaClient | undefined;
}

function createClient() {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

if (process.env.NODE_ENV === "production") {
  prisma = createClient();
} else {
  if (!global.__db__) {
    global.__db__ = createClient();
  }
  prisma = global.__db__;
}

export { prisma };
