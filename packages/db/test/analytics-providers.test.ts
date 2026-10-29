import { describe, expect, it } from "vitest";
import { checkCompatibility, parseGa4AccountSummaries } from "../src/analytics/providers/ga4";
import { parseGscSites } from "../src/analytics/providers/gsc";
import { parseSemanticModel, wixDataWindow } from "../src/analytics/providers/wix";
import { safeSearchQuery } from "../src/analytics/measure";

describe("analytics provider fixtures", () => {
  it("treats fixture discovery as labelled and refuses an unknown dimension", () => {
    expect(checkCompatibility({ metrics: ["sessions"], dimensions: ["date"] }, null)).toBe("unknown");
    expect(checkCompatibility(
      { metrics: ["sessions"], dimensions: ["date", "userAgeBracket"] },
      { metrics: ["sessions"], dimensions: ["date"], status: "supported" },
    )).toBe("unsupported");
    expect(parseGa4AccountSummaries({
      accountSummaries: [{ displayName: "Fixture clinic", propertySummaries: [{ property: "properties/123456", displayName: "Fixture property" }] }],
    })).toEqual([{ id: "123456", label: "Fixture clinic · Fixture property" }]);
    expect(parseGscSites({ siteEntry: [{ siteUrl: "sc-domain:fixture.example", permissionLevel: "siteOwner" }] })).toEqual([
      { id: "sc-domain:fixture.example", label: "sc-domain:fixture.example" },
    ]);
    expect(wixDataWindow("2026-10-27", "2026-01-01", "2026-01-02")).toEqual({ error: "outside_history" });
    expect(parseSemanticModel({ semanticModel: { id: "fixture", slug: "fixture", measures: [{ name: "sessions" }] } })?.fields[0]?.name).toBe("sessions");
    expect(safeSearchQuery("person@example.invalid")).toBeNull();
  });
});
