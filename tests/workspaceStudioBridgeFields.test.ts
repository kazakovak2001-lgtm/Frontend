import assert from "node:assert/strict";
import test from "node:test";
import {
  STUDIO_CONNECTION_FIELD_KEYS,
  STUDIO_SYNC_FIELD_KEYS,
  isStudioConnectionField,
  isStudioSyncField,
  studioBridgeFieldMarker,
} from "../src/services/workspaceStudioBridgeFields.ts";

test("every declared sync field key resolves to the sync marker", () => {
  for (const key of STUDIO_SYNC_FIELD_KEYS) {
    assert.equal(studioBridgeFieldMarker(key), "sync");
    assert.equal(isStudioSyncField(key), true);
    assert.equal(isStudioConnectionField(key), false);
  }
});

test("every declared connection field key resolves to the connection marker", () => {
  for (const key of STUDIO_CONNECTION_FIELD_KEYS) {
    assert.equal(studioBridgeFieldMarker(key), "connection");
    assert.equal(isStudioConnectionField(key), true);
    assert.equal(isStudioSyncField(key), false);
  }
});

// P13: sync and connection protocol entries are visibly and semantically
// distinct. Generates 100 randomized field-key entries mixing known sync
// keys, known connection keys, and unrelated keys, and asserts the sync
// marker renders only for sync entries and never for connection or
// unrelated entries (see STUDIO-SYNC-1A-FE, issue #32).
test("P13 classifies 100 generated Studio bridge entries without cross-marking sync and connection fields", () => {
  const unrelatedKeys = [
    "projectName",
    "ownerId",
    "createdAt",
    "unknownField",
    "",
    "SYNC_REQUEST",
    "GET_PROJECT",
  ];
  const pool: string[] = [
    ...STUDIO_SYNC_FIELD_KEYS,
    ...STUDIO_CONNECTION_FIELD_KEYS,
    ...unrelatedKeys,
  ];

  let seededSync = false;
  let seededConnection = false;
  let seededUnrelated = false;

  for (let index = 0; index < 100; index += 1) {
    const key = pool[index % pool.length];
    const marker = studioBridgeFieldMarker(key);

    if ((STUDIO_SYNC_FIELD_KEYS as readonly string[]).includes(key)) {
      assert.equal(marker, "sync", `expected sync marker for "${key}"`);
      assert.equal(isStudioSyncField(key), true);
      assert.equal(isStudioConnectionField(key), false);
      seededSync = true;
    } else if (
      (STUDIO_CONNECTION_FIELD_KEYS as readonly string[]).includes(key)
    ) {
      assert.equal(marker, "connection", `expected connection marker for "${key}"`);
      assert.equal(isStudioConnectionField(key), true);
      assert.equal(isStudioSyncField(key), false);
      seededConnection = true;
    } else {
      assert.equal(marker, null, `expected no marker for unrelated key "${key}"`);
      assert.equal(isStudioSyncField(key), false);
      assert.equal(isStudioConnectionField(key), false);
      seededUnrelated = true;
    }
  }

  assert.equal(seededSync, true);
  assert.equal(seededConnection, true);
  assert.equal(seededUnrelated, true);
});
