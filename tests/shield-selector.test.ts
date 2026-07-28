import { describe, expect, it } from "vitest";

import {
  isShieldSelectorCloseKey,
  nextShieldFocus,
} from "../app/game/shield-selector";
import { SHIELDS } from "../lib/game";

describe("shield selector", () => {
  it("moves through all six choices with arrows and Home/End", () => {
    const ids = SHIELDS.map(({ id }) => id);

    expect(nextShieldFocus(ids, "shield", "ArrowLeft")).toBe(
      "mag-deflector",
    );
    expect(nextShieldFocus(ids, "shield", "ArrowDown")).toBe(
      "force-shield",
    );
    expect(nextShieldFocus(ids, "none", "Home")).toBe("none");
    expect(nextShieldFocus(ids, "shield", "End")).toBe("super-mag");
    expect(nextShieldFocus(ids, "none", "ArrowLeft")).toBe("none");
    expect(nextShieldFocus(ids, "super-mag", "ArrowRight")).toBe(
      "super-mag",
    );
  });

  it("uses Escape as the explicit close command", () => {
    expect(isShieldSelectorCloseKey("Escape")).toBe(true);
    expect(isShieldSelectorCloseKey("Enter")).toBe(false);
  });
});
