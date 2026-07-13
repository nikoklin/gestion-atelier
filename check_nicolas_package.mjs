import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { packages, residents } from "./drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL);

const result = await db
  .select()
  .from(packages)
  .innerJoin(residents, eq(packages.residentId, residents.id))
  .where(eq(residents.id, 120003));

console.log("Forfaits de Nicolas Klein:");
console.log(JSON.stringify(result, null, 2));
