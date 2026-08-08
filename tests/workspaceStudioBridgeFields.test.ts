import assert from "node:assert/strict";
import test from "node:test";
import {
  STUDIO_CONNECTION_FIELD_ARIA_LABEL,
  STUDIO_CONNECTION_FIELD_KEYS,
  STUDIO_SYNC_FIELD_ARIA_LABEL,
  STUDIO_SYNC_FIELD_KEYS,
  isStudioConnectionField,
  isStudioSyncField,
  studioBridgeFieldAriaLabel,
  studioBridgeFieldMarker,
} from "../src/services/workspaceStudioBridgeFields.ts";

test("every declared sync field key resolves to the sync marker and label", () => {
  for (const key of STUDIO_SYNC_FIELD_KEYS) {
    assert.equal(studioBridgeFieldMarker(key), "sync");
    assert.equal(studioBridgeFieldAriaLabel(key), STUDIO_SYNC_FIELD_ARIA_LABEL);
    assert.equal(isStudioSyncField(key), true);
    assert.equal(isStudioConnectionField(key), false);
  }
});

test("every declared connection field key resolves to the connection marker and label", () => {
  for (const key of STUDIO_CONNECTION_FIELD_KEYS) {
    assert.equal(studioBridgeFieldMarker(key), "connection");
    assert.equal(
      studioBridgeFieldAriaLabel(key),
      STUDIO_CONNECTION_FIELD_ARIA_LABEL,
    );
    assert.equal(isStudioConnectionField(key), true);
    assert.equal(isStudioSyncField(key), false);
  }
});

// Deterministic seeded PRNG (mulberry32) so the P13 run below is
// reproducible across CI runs while still varying its unrelated-key inputs
// instead of cycling a fixed literal list.
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomUnrelatedKey(random: () => number): string {
  const length = 4 + Math.floor(random() * 12);
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "";
  for (let i = 0; i < length; i += 1) {
    key += alphabet[Math.floor(random() * alphabet.length)];
  }
  return key;
}

// P13: sync and connection protocol entries are visibly and semantically
// distinct. Generates 100 randomized field-key entries mixing known sync
// keys, known connection keys, and randomly generated unrelated keys, and
// asserts the sync marker/label render only for sync entries, the
// connection marker/label only for connection entries, and neither for any
// generated unrelated entry (see STUDIO-SYNC-1A-FE, issue #32).
//
// This exercises the classification/label functions that back the rendered
// marker (`DataField` in WorkspaceStageCanvas.tsx reads both from this same
// module, so they cannot diverge from what is asserted here). It does not
// render the component itself: the workspace test runner
// (`node --experimental-strip-types --test`) cannot load .tsx/JSX modules,
// so a true DOM-rendering assertion is not currently possible without a
// separate test pipeline, which is out of scope for this fix.
test("P13 classifies 100 generated Studio bridge entries without cross-marking sync and connection fields", () => {
  const random = mulberry32(0x53_31_33); // "S13"
  const knownSync = [...STUDIO_SYNC_FIELD_KEYS];
  const knownConnection = [...STUDIO_CONNECTION_FIELD_KEYS];

  let seededSync = false;
  let seededConnection = false;
  let seededUnrelated = false;

  for (let index = 0; index < 100; index += 1) {
    const category = Math.floor(random() * 3);
    const key =
      category === 0
        ? knownSync[Math.floor(random() * knownSync.length)]
        : category === 1
          ? knownConnection[Math.floor(random() * knownConnection.length)]
          : randomUnrelatedKey(random);

    const marker = studioBridgeFieldMarker(key);
    const label = studioBridgeFieldAriaLabel(key);

    if ((STUDIO_SYNC_FIELD_KEYS as readonly string[]).includes(key)) {
      assert.equal(marker, "sync", `expected sync marker for "${key}"`);
      assert.equal(label, STUDIO_SYNC_FIELD_ARIA_LABEL);
      assert.equal(isStudioSyncField(key), true);
      assert.equal(isStudioConnectionField(key), false);
      seededSync = true;
    } else if (
      (STUDIO_CONNECTION_FIELD_KEYS as readonly string[]).includes(key)
    ) {
      assert.equal(
        marker,
        "connection",
        `expected connection marker for "${key}"`,
      );
      assert.equal(label, STUDIO_CONNECTION_FIELD_ARIA_LABEL);
      assert.equal(isStudioConnectionField(key), true);
      assert.equal(isStudioSyncField(key), false);
      seededConnection = true;
    } else {
      assert.equal(
        marker,
        null,
        `expected no marker for generated unrelated key "${key}"`,
      );
      assert.equal(label, null);
      assert.equal(isStudioSyncField(key), false);
      assert.equal(isStudioConnectionField(key), false);
      seededUnrelated = true;
    }
  }

  assert.equal(seededSync, true);
  assert.equal(seededConnection, true);
  assert.equal(seededUnrelated, true);
});
