import test from "node:test";
import assert from "node:assert/strict";
import { getAllowedNextStatuses } from "../src/lib/order-workflow.mjs";

test("orders move through the expected lifecycle", () => {
  assert.deepEqual(getAllowedNextStatuses("new", "owner"), ["accepted", "cancelled"]);
  assert.deepEqual(getAllowedNextStatuses("accepted", "manager"), ["preparing", "cancelled"]);
  assert.deepEqual(getAllowedNextStatuses("preparing", "cashier"), ["ready", "cancelled"]);
  assert.deepEqual(getAllowedNextStatuses("ready", "owner"), ["served", "cancelled"]);
});

test("terminal order states cannot be reopened or changed", () => {
  assert.deepEqual(getAllowedNextStatuses("served", "owner"), []);
  assert.deepEqual(getAllowedNextStatuses("cancelled", "manager"), []);
});

test("kitchen role can only perform kitchen transitions", () => {
  assert.deepEqual(getAllowedNextStatuses("new", "kitchen"), ["accepted"]);
  assert.deepEqual(getAllowedNextStatuses("accepted", "kitchen"), ["preparing"]);
  assert.deepEqual(getAllowedNextStatuses("preparing", "kitchen"), ["ready"]);
  assert.deepEqual(getAllowedNextStatuses("ready", "kitchen"), []);
});

test("service role can only complete ready orders", () => {
  assert.deepEqual(getAllowedNextStatuses("ready", "service"), ["served", "cancelled"]);
  assert.deepEqual(getAllowedNextStatuses("new", "service"), []);
  assert.deepEqual(getAllowedNextStatuses("accepted", "service"), []);
});

test("unknown states fail closed", () => {
  assert.deepEqual(getAllowedNextStatuses("unknown", "owner"), []);
});
