import { describe, expect, it } from "vitest";

import { labDatabaseFile } from "../src/lib/lab-safety";

describe("labDatabaseFile", () => {
  it("selects only the dedicated lab database file for reset", () => {
    expect(labDatabaseFile("file:./data/ajito-security-lab.db")).toBe("data/ajito-security-lab.db");
  });

  it("rejects any other database before reset can delete it", () => {
    expect(() => labDatabaseFile("file:./data/ajito.db")).toThrow("専用データベース");
  });
});
