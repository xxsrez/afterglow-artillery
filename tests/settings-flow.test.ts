import { describe, expect, it } from "vitest";

import {
  settingsScreenAfterPageLifecycle,
  transitionSettingsScreen,
  type PageLifecycleEvent,
} from "../app/game/settings-flow";

describe("settings flow", () => {
  it("requires the start settings screen before entering a match", () => {
    expect(transitionSettingsScreen("start", "open-settings", "intro")).toBe(
      "start",
    );
    expect(transitionSettingsScreen("start", "start-match", "intro")).toBe(
      "closed",
    );
  });

  it("opens match settings from aiming or a paused flight", () => {
    expect(
      transitionSettingsScreen("closed", "open-settings", "aiming"),
    ).toBe("match");
    expect(
      transitionSettingsScreen("closed", "open-settings", "firing"),
    ).toBe("match");
    expect(
      transitionSettingsScreen("closed", "open-settings", "roundEnd"),
    ).toBe("closed");
  });

  it("closes back to the match without changing the game snapshot", () => {
    const gameSnapshot = Object.freeze({
      turn: 4,
      activePlayer: 1,
      angle: 47,
      power: 680,
      weapon: "funky-bomb",
    });
    const before = { game: gameSnapshot, settings: "match" as const };
    const after = {
      game: before.game,
      settings: transitionSettingsScreen(
        before.settings,
        "close-settings",
        "aiming",
      ),
    };

    expect(after.settings).toBe("closed");
    expect(after.game).toBe(gameSnapshot);
  });

  it.each<PageLifecycleEvent>(["blur", "focus", "hidden", "visible"])(
    "keeps the current screen on %s",
    (event) => {
      expect(settingsScreenAfterPageLifecycle("closed", event)).toBe("closed");
      expect(settingsScreenAfterPageLifecycle("match", event)).toBe("match");
    },
  );
});
