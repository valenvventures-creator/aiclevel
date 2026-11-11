import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { EXECUTIVE_SEEDS } from "@/config/executives/defaults";
import { relocateAvatar } from "@/server/organizations/stored-labels";

describe("executive portraits", () => {
  it("ship with the app for all seven executives", () => {
    for (const s of EXECUTIVE_SEEDS) {
      expect(s.avatar_url.startsWith("/brand/executives/")).toBe(true);
      expect(existsSync(join(process.cwd(), "public", s.avatar_url))).toBe(true);
    }
  });

  it("moves stored portraits off the retired thoughtauthorities.com host", () => {
    expect(relocateAvatar("https://thoughtauthorities.com/assets/avatars/web-director.jpg")).toBe("/brand/executives/web-director.jpg");
    expect(relocateAvatar("https://cdn.example.com/me.png")).toBe("https://cdn.example.com/me.png");
    expect(relocateAvatar(null)).toBeNull();
  });
});
