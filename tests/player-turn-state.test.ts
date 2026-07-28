import { describe, expect, it } from "vitest";

import {
  BASELINE_WEAPON_ID,
  availableSelectedWeapon,
  consumePlayerWeapon,
  nextPlayerIndex,
  restoreAvailableSelectedWeapon,
  selectPlayerWeapon,
  updatePlayerAim,
  type PlayerTurnState,
} from "../lib/game";

function makeTurnState(
  inventory: PlayerTurnState["inventory"],
): PlayerTurnState {
  return {
    selectedWeapon: BASELINE_WEAPON_ID,
    angleDegrees: 48,
    power: 400,
    inventory: { ...inventory },
  };
}

describe("hot-seat player turn state", () => {
  it("restores independent weapon, angle, and power across P1 → P2 → P1 → P2", () => {
    const players = [
      makeTurnState({ missile: 2 }),
      makeTurnState({ nuke: 2 }),
    ] as const;
    let activePlayer: 0 | 1 = 0;

    expect(selectPlayerWeapon(players[activePlayer], "missile")).toBe(true);
    updatePlayerAim(players[activePlayer], {
      angleDegrees: 37,
      power: 530,
    });

    activePlayer = nextPlayerIndex(activePlayer);
    expect(players[activePlayer]).toMatchObject({
      selectedWeapon: BASELINE_WEAPON_ID,
      angleDegrees: 48,
      power: 400,
    });
    expect(selectPlayerWeapon(players[activePlayer], "nuke")).toBe(true);
    updatePlayerAim(players[activePlayer], {
      angleDegrees: 71,
      power: 820,
    });

    activePlayer = nextPlayerIndex(activePlayer);
    expect(players[activePlayer]).toMatchObject({
      selectedWeapon: "missile",
      angleDegrees: 37,
      power: 530,
    });

    activePlayer = nextPlayerIndex(activePlayer);
    expect(players[activePlayer]).toMatchObject({
      selectedWeapon: "nuke",
      angleDegrees: 71,
      power: 820,
    });
  });

  it("isolates finite inventory and applies fallback only to its owner", () => {
    const first = makeTurnState({ missile: 1 });
    const second = makeTurnState({ missile: 1 });

    expect(selectPlayerWeapon(first, "missile")).toBe(true);
    expect(selectPlayerWeapon(second, "missile")).toBe(true);
    expect(consumePlayerWeapon(first, "missile")).toBe(0);

    expect(first.inventory.missile).toBe(0);
    expect(second.inventory.missile).toBe(1);
    expect(availableSelectedWeapon(first)).toBe(BASELINE_WEAPON_ID);
    expect(availableSelectedWeapon(second)).toBe("missile");

    expect(restoreAvailableSelectedWeapon(first)).toBe(BASELINE_WEAPON_ID);
    expect(first.selectedWeapon).toBe(BASELINE_WEAPON_ID);
    expect(second.selectedWeapon).toBe("missile");
    expect(selectPlayerWeapon(first, "missile")).toBe(false);
    expect(second.inventory.missile).toBe(1);
  });
});
