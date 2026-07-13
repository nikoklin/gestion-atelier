import { drizzle } from "drizzle-orm/mysql2";
import { eq, and } from "drizzle-orm";
import { residents } from "./drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL);

const result = await db
  .select()
  .from(residents)
  .where(and(eq(residents.firstName, "Nicolas"), eq(residents.lastName, "Klein")));

console.log("Tous les Nicolas Klein:");
console.log(JSON.stringify(result, null, 2));
