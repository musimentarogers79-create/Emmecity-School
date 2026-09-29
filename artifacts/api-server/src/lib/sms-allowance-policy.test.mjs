import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isAmbiguousSmsFailure,
  reserveSmsMessages,
  settleSmsMessages,
} from "./sms-allowance-policy.ts";
import {
  createSupportSession,
  isSupportUser,
  isValidSupportSession,
  supportUserIdForSchool,
  SUPPORT_USER_IDENTIFIER,
} from "./support-auth.ts";

test("SMS reservation denies over-quota requests and only spends confirmed sends", () => {
  const balance = { availableMessages: 3, reservedMessages: 0, sentMessages: 4 };
  const reserved = reserveSmsMessages(balance, 2);
  assert.deepEqual(reserved, { availableMessages: 1, reservedMessages: 2, sentMessages: 4 });
  assert.equal(reserveSmsMessages(balance, 4), undefined);
  assert.deepEqual(settleSmsMessages(reserved, 2, "sent"), {
    availableMessages: 1,
    reservedMessages: 0,
    sentMessages: 6,
  });
});

test("confirmed failures refund reservations; inconsistent recovery is rejected", () => {
  const reserved = reserveSmsMessages({ availableMessages: 5, reservedMessages: 1, sentMessages: 8 }, 3);
  const refunded = settleSmsMessages(reserved, 3, "failed");
  assert.deepEqual(refunded, {
    availableMessages: 5,
    reservedMessages: 1,
    sentMessages: 8,
  });
  assert.throws(() => settleSmsMessages(refunded, 3, "failed"), /inconsistent/u);
  assert.throws(() => settleSmsMessages(reserved, 5, "failed"), /inconsistent/u);
});

test("ambiguous provider outcomes require reconciliation rather than a refund", () => {
  for (const reason of ["timeout", "network_error", "invalid_response_http_200", "http_500"]) {
    assert.equal(isAmbiguousSmsFailure(reason), true);
  }
  for (const reason of ["provider_rejected", "http_401", "http_404"]) {
    assert.equal(isAmbiguousSmsFailure(reason), false);
  }
});

test("Support identity has a stable per-school actor ID and a separate signed session", () => {
  const firstId = supportUserIdForSchool("school-a");
  assert.equal(supportUserIdForSchool("school-a"), firstId);
  assert.notEqual(supportUserIdForSchool("school-b"), firstId);
  assert.equal(isSupportUser({ identifier: SUPPORT_USER_IDENTIFIER }), true);

  const oldSessionSecret = process.env["SESSION_SECRET"];
  const oldSupportPassword = process.env["SCHOOL_SUPPORT_PASSWORD"];
  process.env["SESSION_SECRET"] = "unit-test-session-secret";
  process.env["SCHOOL_SUPPORT_PASSWORD"] = "unit-test-support-password";
  try {
    const session = createSupportSession();
    assert.equal(isValidSupportSession(session.token), true);
    assert.equal(isValidSupportSession(`${session.token}tampered`), false);
    process.env["SESSION_SECRET"] = "different-secret";
    assert.equal(isValidSupportSession(session.token), false);
  } finally {
    if (oldSessionSecret === undefined) delete process.env["SESSION_SECRET"];
    else process.env["SESSION_SECRET"] = oldSessionSecret;
    if (oldSupportPassword === undefined) delete process.env["SCHOOL_SUPPORT_PASSWORD"];
    else process.env["SCHOOL_SUPPORT_PASSWORD"] = oldSupportPassword;
  }
});