import assert from "node:assert/strict";
import { Role } from "@prisma/client";
import { isAccountLocked, nextLoginFailureState, passwordPolicyError } from "../src/utils/password-policy.js";
import { canDeactivateLastActiveAdmin, canDeactivateUser } from "../src/utils/account-governance.js";
import { redactSensitive } from "../src/utils/redact.js";

const now = new Date("2026-06-01T12:00:00.000Z");

assert.match(passwordPolicyError("a1", "Oldpass1", "person@example.com") ?? "", /at least/);
assert.match(passwordPolicyError("longpassword", "Oldpass1", "person@example.com") ?? "", /letter and a number/);
assert.match(passwordPolicyError("password1", "Oldpass1", "person@example.com") ?? "", /common password/);
assert.match(passwordPolicyError("Oldpass1", "Oldpass1", "person@example.com") ?? "", /differ/);
assert.match(passwordPolicyError("personA1", "Oldpass1", "person@example.com") ?? "", /email/);
assert.equal(passwordPolicyError("StrongPass2", "Oldpass1", "person@example.com"), null);

assert.deepEqual(nextLoginFailureState(4, now), {
  failedLoginCount: 0,
  lockedUntil: new Date(now.getTime() + 15 * 60_000),
});
assert.deepEqual(nextLoginFailureState(2, now), { failedLoginCount: 3, lockedUntil: null });
assert.equal(isAccountLocked(new Date(now.getTime() + 1), now), true);
assert.equal(isAccountLocked(now, now), false);
assert.equal(isAccountLocked(null, now), false);

assert.deepEqual(redactSensitive({
  PassWord: "value",
  list: [{ tokenValue: "value" }, { safe: "visible", nested: { cOoKiE: "value" } }],
  authorization: { header: "value" },
}), {
  PassWord: "[REDACTED]",
  list: [{ tokenValue: "[REDACTED]" }, { safe: "visible", nested: { cOoKiE: "[REDACTED]" } }],
  authorization: "[REDACTED]",
});

assert.equal(canDeactivateUser("same", "same", false), false);
assert.equal(canDeactivateUser("same", "same", true), true);
assert.equal(canDeactivateLastActiveAdmin(Role.ADMIN, true, false, 1), false);
assert.equal(canDeactivateLastActiveAdmin(Role.ADMIN, true, false, 2), true);
assert.equal(canDeactivateLastActiveAdmin(Role.TEACHER, true, false, 0), true);

console.log("Security and governance unit tests passed");
