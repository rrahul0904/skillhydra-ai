import assert from "node:assert/strict";
import test from "node:test";

import { isRegistryAdminAuthorized, registryAdminTokenConfigured } from "../apps/web/lib/registry-admin-auth.ts";

const secret = "0123456789abcdefghijklmn";

test("registry moderation requires a sufficiently long configured secret", () => {
  assert.equal(registryAdminTokenConfigured(undefined), false);
  assert.equal(registryAdminTokenConfigured("short"), false);
  assert.equal(registryAdminTokenConfigured(secret), true);
});

test("registry moderation bearer comparison is exact and fails closed", () => {
  assert.equal(isRegistryAdminAuthorized(`Bearer ${secret}`, secret), true);
  assert.equal(isRegistryAdminAuthorized(`Bearer ${secret}x`, secret), false);
  assert.equal(isRegistryAdminAuthorized("Bearer wrong", secret), false);
  assert.equal(isRegistryAdminAuthorized(null, secret), false);
  assert.equal(isRegistryAdminAuthorized(`Bearer ${secret}`, undefined), false);
});
