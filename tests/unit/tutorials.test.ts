import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TUTORIAL_CATEGORIES, TUTORIALS } from "@/config/tutorials";
import { TUTORIAL_MEDIA } from "@/config/tutorial-media";
import { ALL_NAV } from "@/components/shell/nav-config";

describe("Tutorials", () => {
  it("has unique slugs, valid categories and working related links", () => {
    const slugs = TUTORIALS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const cats = new Set(TUTORIAL_CATEGORIES.map((c) => c.name));
    for (const t of TUTORIALS) {
      expect(cats.has(t.category)).toBe(true);
      for (const r of t.related) expect(slugs, `${t.slug} → ${r}`).toContain(r);
      expect(t.steps.length).toBeGreaterThan(0);
      expect(t.flow.length).toBeGreaterThan(1);
    }
    for (const c of TUTORIAL_CATEGORIES) expect(TUTORIALS.some((t) => t.category === c.name)).toBe(true);
  });

  it("uses only screenshots that exist", () => {
    for (const t of TUTORIALS) {
      for (const s of t.steps) {
        if (!s.image) continue;
        expect(TUTORIAL_MEDIA[s.image.name], `${t.slug}: ${s.image.name}`).toBeDefined();
        expect(existsSync(join(process.cwd(), "public/tutorials/media", `${s.image.name}.webp`))).toBe(true);
        expect(s.image.alt.length).toBeGreaterThan(5);
      }
    }
  });

  it("covers every area in the menu", () => {
    const covered = TUTORIALS.flatMap((t) => [t.open?.href ?? "", t.title]).join(" ");
    const areas = ALL_NAV.filter((n) => n.href !== "/tutorials");
    const index = readFileSync(join(process.cwd(), "src/app/(c-suite)/tutorials/page.tsx"), "utf8");
    for (const a of areas) expect(index, `map entry for ${a.href}`).toContain(`"${a.href}":`);
    expect(covered.length).toBeGreaterThan(0);
    expect(ALL_NAV.some((n) => n.href === "/tutorials")).toBe(true);
  });

  it("is only reachable when signed in", () => {
    const proxy = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    expect(proxy).toMatch(/PROTECTED = \[[^\]]*"\/tutorials"/);
  });
});
