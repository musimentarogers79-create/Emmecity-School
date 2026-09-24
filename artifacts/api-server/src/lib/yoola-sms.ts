import { compactSingleSegmentSms } from "./single-segment-sms";

const YoolaSendUrl = "https://yoolasms.com/api/v1/send";
const SMS_REQUEST_TIMEOUT_MS = 15_000;

export type YoolaSmsResult =
  | { status: "sent"; recipientCount: number; messageId?: string }
  | { status: "disabled"; recipientCount: number }
  | { status: "skipped"; recipientCount: number; reason: "no_recipients" | "empty_message" }
  | { status: "failed"; recipientCount: number; reason: string };

export type YoolaSmsOptions = {
  apiKey?: string;
  senderId?: string;
  fetcher?: typeof fetch;
};

/**
 * Yoola's Uganda examples use country-code digits without a leading plus.
 * For local Ugandan mobile numbers, add country code 256; accept E.164-like
 * international numbers as country-code digits as well.
 */
export function normalizeYoolaPhone(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const primary = value.trim().split(/[;,|\u002F\n]/u, 1)[0]?.trim() || "";
  if (!primary) return undefined;

  const startsWith00 = primary.startsWith("00");
  const startsWithPlus = primary.startsWith("+");
  let digits = primary.replace(/\D/gu, "");
  if (startsWith00) digits = digits.replace(/^00/u, "");
  if (!startsWithPlus && !startsWith00 && /^0\d{9}$/u.test(digits)) {
    digits = `256${digits.slice(1)}`;
  } else if (!startsWithPlus && !startsWith00 && /^7\d{8}$/u.test(digits)) {
    digits = `256${digits}`;
  }

  return /^[1-9]\d{7,14}$/u.test(digits) ? digits : undefined;
}

export function isYoolaSmsConfigured(): boolean {
  return Boolean(process.env["YOOLA_SMS_API_KEY"]?.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function providerAccepted(payload: unknown): payload is Record<string, unknown> {
  if (!isRecord(payload)) return false;
  if (payload["success"] === true) return true;
  const status = typeof payload["status"] === "string"
    ? payload["status"].trim().toLowerCase()
    : "";
  return status === "success" || status === "sent" || status === "queued";
}

function providerMessageId(payload: Record<string, unknown>): string | undefined {
  const candidate = payload["message_id"] ?? payload["messageId"];
  if (typeof candidate !== "string") return undefined;
  const value = candidate.trim();
  return /^[a-zA-Z0-9._-]{1,128}$/u.test(value) ? value : undefined;
}

/**
 * Sends one text body to one or more recipients. This function is the only
 * network boundary for outbound Yoola SMS; callers must reserve an
 * idempotency record before invoking it.
 */
export async function sendYoolaSms(
  phoneNumbers: string[],
  body: string,
  options: YoolaSmsOptions = {},
): Promise<YoolaSmsResult> {
  const phones = [...new Set(phoneNumbers.map(normalizeYoolaPhone).filter((phone): phone is string => Boolean(phone)))];
  if (!phones.length) return { status: "skipped", recipientCount: 0, reason: "no_recipients" };

  const message = compactSingleSegmentSms(body);
  if (!message) return { status: "skipped", recipientCount: phones.length, reason: "empty_message" };

  const apiKey = (options.apiKey ?? process.env["YOOLA_SMS_API_KEY"] ?? "").trim();
  if (!apiKey) return { status: "disabled", recipientCount: phones.length };

  const payload: Record<string, string> = {
    api_key: apiKey,
    phone: phones.join(","),
    message,
  };
  const senderId = (options.senderId ?? process.env["YOOLA_SMS_SENDER_ID"] ?? "").trim();
  if (senderId) payload["sender"] = senderId;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SMS_REQUEST_TIMEOUT_MS);
  timeout.unref?.();

  try {
    const response = await (options.fetcher ?? fetch)(YoolaSendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const responseText = await response.text();
    let responseBody: unknown;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      return { status: "failed", recipientCount: phones.length, reason: `invalid_response_http_${response.status}` };
    }
    if (!response.ok) {
      return { status: "failed", recipientCount: phones.length, reason: `http_${response.status}` };
    }
    if (!providerAccepted(responseBody)) {
      return { status: "failed", recipientCount: phones.length, reason: "provider_rejected" };
    }
    const messageId = providerMessageId(responseBody);
    return {
      status: "sent",
      recipientCount: phones.length,
      ...(messageId ? { messageId } : {}),
    };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error";
    return { status: "failed", recipientCount: phones.length, reason };
  } finally {
    clearTimeout(timeout);
  }
}