import { describe, expect, it } from "vitest";

const { ProjectInput, createProject, updateProject, mappable } = await import("@/server/projects/service");
const { toPlaces } = await import("@/server/projects/geocode");
const { storeFile, listCompanyFiles } = await import("@/server/files/service");
const { db } = await import("@/server/db/store");

const org = { id: "org-projects-map", name: "Map Test", slug: "map-test", logo_url: null, owner_id: "u1", industry: null, subscription_status: "TRIAL" as const, is_demo: false, created_at: new Date().toISOString() };
// Smallest valid PNG header (the upload check looks at the file signature).
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe("project location and image", () => {
  it("validates coordinates and requires both or neither", () => {
    expect(ProjectInput.parse({ name: "Austin office", latitude: "30.26721234", longitude: "-97.7431" })).toMatchObject({ latitude: 30.267212, longitude: -97.7431, location_label: null });
    expect(ProjectInput.safeParse({ name: "Bad", latitude: "95", longitude: "0" }).success).toBe(false);
    expect(ProjectInput.safeParse({ name: "Half", latitude: "30", longitude: "" }).success).toBe(false);
    expect(ProjectInput.parse({ name: "Nowhere", latitude: "", longitude: "" })).toMatchObject({ latitude: null, longitude: null });
  });

  it("stores a cover image that stays out of Files, and puts located projects on the map", async () => {
    const image = await storeFile({ organization: org, userId: "u1", filename: "site.png", bytes: png, purpose: "PROJECT_IMAGE" });
    expect((await listCompanyFiles(org.id)).some((f) => f.id === image.id)).toBe(false);
    expect((await db().memory.list(org.id)).length).toBe(0);

    const p = await createProject(org.id, "u1", ProjectInput.parse({ name: "Austin office", image_file_id: image.id, location_label: "Congress Ave, Austin", latitude: 30.2686, longitude: -97.7427 }));
    const q = await createProject(org.id, "u1", ProjectInput.parse({ name: "No place yet" }));
    expect(mappable([p, q]).map((x) => x.name)).toEqual(["Austin office"]);

    const moved = await updateProject(org.id, q.id, ProjectInput.parse({ name: "No place yet", status: "ON_HOLD", latitude: 41.88, longitude: -87.64 }));
    expect(moved).toMatchObject({ status: "ON_HOLD", latitude: 41.88, longitude: -87.64 });

    // Only an uploaded project image can be used as a cover.
    const doc = await storeFile({ organization: org, userId: "u1", filename: "plan.txt", bytes: new TextEncoder().encode("plan") });
    await expect(createProject(org.id, "u1", ProjectInput.parse({ name: "Wrong file", image_file_id: doc.id }))).rejects.toThrow(/no longer available/);
  });

  it("reads geocoder results and drops malformed ones", () => {
    expect(toPlaces([{ display_name: "Austin, Texas, United States", lat: "30.2711", lon: "-97.7437" }, { display_name: "Broken", lat: "abc", lon: "1" }, { lat: "1", lon: "1" }])).toEqual([
      { label: "Austin, Texas, United States", latitude: 30.2711, longitude: -97.7437 },
    ]);
    expect(toPlaces({ display_name: "Single", lat: "10", lon: "20" })).toEqual([{ label: "Single", latitude: 10, longitude: 20 }]);
    expect(toPlaces(null)).toEqual([]);
  });
});
