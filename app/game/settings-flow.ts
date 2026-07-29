export type SettingsScreen = "start" | "closed" | "match";

export type SettingsFlowEvent =
  | "start-match"
  | "open-settings"
  | "close-settings"
  | "reset-match";

export type PageLifecycleEvent = "blur" | "focus" | "hidden" | "visible";

export function transitionSettingsScreen(
  screen: SettingsScreen,
  event: SettingsFlowEvent,
  phase: string,
): SettingsScreen {
  switch (event) {
    case "start-match":
      return screen === "start" && phase === "intro" ? "closed" : screen;
    case "open-settings":
      return screen === "closed" && phase === "aiming" ? "match" : screen;
    case "close-settings":
      return screen === "match" ? "closed" : screen;
    case "reset-match":
      return "start";
  }
}

export function settingsScreenAfterPageLifecycle(
  screen: SettingsScreen,
  event: PageLifecycleEvent,
): SettingsScreen {
  void event;
  return screen;
}
