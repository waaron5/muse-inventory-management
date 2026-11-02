import { describe, expect, it } from "vitest";
import { clientColour } from "./client-colour";

describe("clientColour", () => {
  it("gives a Client the same colour however its name is typed", () => {
    expect(clientColour("Horizon Tech")).toBe(clientColour("  horizon tech "));
  });

  it("keeps v1's colours for the Clients people know them by", () => {
    expect(clientColour("Ivorypeak")).toBe("rose");
    expect(clientColour("Birchline")).toBe("violet");
    expect(clientColour("Birch Line")).toBe("violet");
  });

  it("spreads other Clients across the palette", () => {
    const names = ["Acme", "Globex", "Initech", "Umbrella", "Hooli", "Stark", "Wayne", "Wonka", "Soylent", "Tyrell"];

    expect(new Set(names.map(clientColour)).size).toBeGreaterThan(2);
  });
});
