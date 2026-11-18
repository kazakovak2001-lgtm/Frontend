export type GameCreationWindow = "concept" | "map" | "gameplay";

export const GAME_CREATION_WINDOWS: ReadonlyArray<{
  id: GameCreationWindow;
  label: string;
}> = [
  { id: "concept", label: "Game Concept" },
  { id: "map", label: "Map & Environment" },
  { id: "gameplay", label: "Gameplay Configuration" },
];

export function isGameCreationWindow(
  value: unknown,
): value is GameCreationWindow {
  return value === "concept" || value === "map" || value === "gameplay";
}
