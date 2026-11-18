import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildConceptPatch,
  buildMapPatch,
  conceptFormFromProject,
  mapFormFromProject,
  readDesignSection,
  reconcileForm,
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

// ── Project refresh while a form is open (CodeRabbit PR #84, MAJOR) ───────

test("stale form without reconcile would overwrite a refreshed value", () => {
  // Documents the original defect: the form is compared with the latest
  // project, so an untouched field still holding the old value looks edited.
  const opened = { ...base, gameConcept: { vision: "V" } };
  const form = { ...conceptFormFromProject(opened), vision: "V edited" };
  const refreshed = {
    ...opened,
    gameConcept: { vision: "V", gameplayLoop: "Loop from generation" },
  };
  assert.deepEqual(buildConceptPatch(refreshed, form), {
    gameConcept: { vision: "V edited", gameplayLoop: "" },
  });
});

test("concept: refresh adopts untouched fields, save sends only the user edit", () => {
  const opened = { ...base, gameConcept: { vision: "V" } };
  const baseline = conceptFormFromProject(opened);
  const edited = { ...baseline, vision: "V edited" };
  const refreshed = {
    ...opened,
    description: "Idea from generation",
    gameConcept: {
      vision: "V",
      gameplayLoop: "Loop from generation",
      coreMechanics: ["jump"],
    },
  };
  const merged = reconcileForm(
    baseline,
    edited,
    conceptFormFromProject(refreshed),
  );
  assert.equal(merged.vision, "V edited");
  assert.equal(merged.gameplayLoop, "Loop from generation");
  assert.equal(merged.coreMechanics, "jump");
  assert.equal(merged.description, "Idea from generation");
  assert.deepEqual(buildConceptPatch(refreshed, merged), {
    gameConcept: { vision: "V edited" },
  });
});

test("concept: refresh with no user edits is not dirty", () => {
  const opened = { ...base };
  const baseline = conceptFormFromProject(opened);
  const refreshed = { ...opened, gameConcept: { gameplayLoop: "L" } };
  const merged = reconcileForm(
    baseline,
    baseline,
    conceptFormFromProject(refreshed),
  );
  assert.equal(buildConceptPatch(refreshed, merged), null);
});

test("map: refresh adopts untouched fields, save sends only the user edit", () => {
  const opened = { ...base, mapEnvironment: { worldTheme: "Desert" } };
  const baseline = mapFormFromProject(opened);
  const edited = { ...baseline, atmosphere: "misty" };
  const refreshed = {
    ...opened,
    mapEnvironment: { worldTheme: "Ice", mainLocations: ["Hub"] },
  };
  const merged = reconcileForm(baseline, edited, mapFormFromProject(refreshed));
  assert.equal(merged.worldTheme, "Ice");
  assert.equal(merged.mainLocations, "Hub");
  assert.equal(merged.atmosphere, "misty");
  assert.deepEqual(buildMapPatch(refreshed, merged), {
    mapEnvironment: { atmosphere: "misty" },
  });
});

test("reconcile keeps a user-edited field and returns same object if unchanged", () => {
  const opened = { ...base, mapEnvironment: { worldTheme: "Desert" } };
  const baseline = mapFormFromProject(opened);
  const edited = { ...baseline, worldTheme: "Mine" };
  const refreshed = { ...opened, mapEnvironment: { worldTheme: "Ice" } };
  const merged = reconcileForm(baseline, edited, mapFormFromProject(refreshed));
  assert.equal(merged.worldTheme, "Mine");
  assert.equal(
    reconcileForm(baseline, baseline, mapFormFromProject(opened)),
    baseline,
  );
});
