export type SmsQuotaBalance = {
  availableMessages: number;
  reservedMessages: number;
  sentMessages: number;
};

export function reserveSmsMessages(balance: SmsQuotaBalance, recipientCount: number): SmsQuotaBalance | undefined {
  if (!Number.isSafeInteger(recipientCount) || recipientCount < 1) {
    throw new Error("A positive whole-number recipient count is required.");
  }
  if (balance.availableMessages < recipientCount) return undefined;
  return {
    availableMessages: balance.availableMessages - recipientCount,
    reservedMessages: balance.reservedMessages + recipientCount,
    sentMessages: balance.sentMessages,
  };
}

export function settleSmsMessages(
  balance: SmsQuotaBalance,
  reservationCount: number,
  outcome: "sent" | "failed",
): SmsQuotaBalance {
  if (!Number.isSafeInteger(reservationCount) || reservationCount < 1 || balance.reservedMessages < reservationCount) {
    throw new Error("SMS allowance reservation is inconsistent.");
  }
  return {
    availableMessages: balance.availableMessages + (outcome === "failed" ? reservationCount : 0),
    reservedMessages: balance.reservedMessages - reservationCount,
    sentMessages: balance.sentMessages + (outcome === "sent" ? reservationCount : 0),
  };
}

export function isAmbiguousSmsFailure(reason: string): boolean {
  return ["timeout", "network_error"].includes(reason)
    || reason.startsWith("invalid_response_")
    || /^http_5\d\d$/u.test(reason);
}