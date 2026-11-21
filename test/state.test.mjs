import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedTransitions,
  canTransition,
  isTaskState,
  legacyStatus,
  stateFromLegacy,
  stateOfTask,
} from "../src/state.ts";

test("task states are restricted to the defined state machine", () => {
  for (const state of ["pending", "assigned", "running", "completed", "failed", "blocked", "cancelled"]) {
    assert.equal(isTaskState(state), true);
  }
  assert.equal(isTaskState("in_progress"), false);
  assert.equal(isTaskState("unknown"), false);
});

test("valid transitions are allowed", () => {
  assert.equal(canTransition("pending", "assigned"), true);
  assert.equal(canTransition("assigned", "running"), true);
  assert.equal(canTransition("running", "completed"), true);
  assert.equal(canTransition("running", "failed"), true);
  assert.equal(canTransition("running", "blocked"), true);
  assert.equal(canTransition("failed", "running"), true);
  assert.equal(canTransition("blocked", "assigned"), true);
  assert.equal(canTransition("completed", "running"), true);
  assert.equal(canTransition("cancelled", "cancelled"), true);
});

test("invalid transitions are rejected", () => {
  assert.equal(canTransition("pending", "completed"), false);
  assert.equal(canTransition("pending", "running"), false);
  assert.equal(canTransition("assigned", "completed"), false);
  assert.equal(canTransition("cancelled", "assigned"), false);
  assert.equal(canTransition("cancelled", "running"), false);
  assert.deepEqual(allowedTransitions("cancelled"), ["cancelled"]);
});

test("legacy status mapping stays backward compatible", () => {
  assert.equal(legacyStatus("running"), "in_progress");
  assert.equal(legacyStatus("failed"), "blocked");
  assert.equal(legacyStatus("blocked"), "blocked");
  assert.equal(legacyStatus("completed"), "completed");
  assert.equal(stateFromLegacy("in_progress"), "running");
  assert.equal(stateFromLegacy("completed"), "completed");
  assert.equal(stateFromLegacy("unknown"), "pending");
  assert.equal(stateOfTask({ execution_state: "failed", status: "blocked" }), "failed");
  assert.equal(stateOfTask({ status: "in_progress" }), "running");
});
