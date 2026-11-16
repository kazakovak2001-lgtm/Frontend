import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildConceptPatch,
  buildMapPatch,
  conceptFormFromProject,
  mapFormFromProject,
  readDesignSection,
  validateConceptForm,
  validateMapForm,
} from "../src/services/projectDesignForm.ts";
import type { Project } from "../src/types/index.ts";

const base: Project = {
  id: "p1",
  name: "Game",
  description: "Idea",
  gameType: "rpg",
  genre: "RPG",
  difficulty: "Medium",
  players: "1–10",
  targetAudience: "Everyone",
  status: "draft",
  progress: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  thumbnailHue: 1,
};

test("legacy project (no sections) loads empty forms", () => {
  const c = conceptFormFromProject(base);
  assert.equal(c.vision, "");
  assert.equal(c.coreMechanics, "");
  assert.equal(c.description, "Idea");
  assert.equal(mapFormFromProject(base).worldTheme, "");
});

test("loads stored sections into line-based forms", () => {
  const p = {
    ...base,
    gameConcept: { vision: "V", coreMechanics: ["a", "b"] },
    mapEnvironment: { mainLocations: ["Hub", "Cave"] },
  };
  assert.equal(conceptFormFromProject(p).coreMechanics, "a\nb");
  assert.equal(mapFormFromProject(p).mainLocations, "Hub\nCave");
});

test("unchanged form produces no patch; edit sends only changed fields", () => {
  const p = { ...base, gameConcept: { vision: "V" } };
  const form = conceptFormFromProject(p);
  assert.equal(buildConceptPatch(p, form), null);
  assert.deepEqual(
    buildConceptPatch(p, {
      ...form,
      gameplayLoop: " loop ",
      coreMechanics: "x\n\ny",
    }),
    { gameConcept: { gameplayLoop: "loop", coreMechanics: ["x", "y"] } },
  );
  assert.deepEqual(buildConceptPatch(p, { ...form, genre: "Obby" }), {
    genre: "Obby",
  });
});

test("clearing a field sends an empty value so the backend can drop it", () => {
  const p = {
    ...base,
    mapEnvironment: { atmosphere: "misty", mainLocations: ["A"] },
  };
  const form = { ...mapFormFromProject(p), atmosphere: "", mainLocations: "" };
  assert.deepEqual(buildMapPatch(p, form), {
    mapEnvironment: { atmosphere: "", mainLocations: [] },
  });
});

test("validation mirrors backend limits", () => {
  const form = conceptFormFromProject(base);
  assert.deepEqual(validateConceptForm(form), {});
  const errors = validateConceptForm({
    ...form,
    targetAudience: " ",
    vision: "x".repeat(2001),
    coreMechanics: new Array(21).fill("m").join("\n"),
  });
  assert.ok(errors.targetAudience && errors.vision && errors.coreMechanics);
  const map = validateMapForm({
    ...mapFormFromProject(base),
    worldTheme: "t".repeat(201),
    constraints: "c".repeat(201),
  });
  assert.ok(map.worldTheme && map.constraints);
});

test("readDesignSection is defensive about backend values", () => {
  assert.equal(readDesignSection(null, "gameConcept"), undefined);
  assert.equal(readDesignSection([], "mapEnvironment"), undefined);
  assert.deepEqual(
    readDesignSection(
      { vision: "v", coreMechanics: ["a", 3], bogus: 1 },
      "gameConcept",
    ),
    { vision: "v", coreMechanics: ["a"] },
  );
});
