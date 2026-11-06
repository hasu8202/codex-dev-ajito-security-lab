import { existsSync, rmSync } from "node:fs";
import { labDatabaseFile, LAB_DATABASE_URL } from "../src/lib/lab-safety";

const databaseFile = labDatabaseFile(process.env.DATABASE_URL || LAB_DATABASE_URL);
if (existsSync(databaseFile)) rmSync(databaseFile);
await import("./seed");
