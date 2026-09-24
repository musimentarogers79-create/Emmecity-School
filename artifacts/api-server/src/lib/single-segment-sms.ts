const GSM_7_BASIC = new Set(
  Array.from(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
  ),
);
const GSM_7_EXTENDED = new Set(Array.from("^{}\\[~]|€\f"));
const SMS_ELLIPSIS = "...";

function gsm7CharacterUnits(character: string): number {
  if (GSM_7_BASIC.has(character)) return 1;
  if (GSM_7_EXTENDED.has(character)) return 2;
  return 0;
}

/**
 * Prepares notification text for a single SMS segment. GSM-7 allows 160
 * septets; messages that require Unicode encoding are limited to 70 UTF-16
 * code units. Full announcement content remains stored separately.
 */
export function compactSingleSegmentSms(message: string): string {
  const normalized = message.replace(/\s+/gu, " ").trim();
  if (!normalized) return "";

  const characters = Array.from(normalized);
  const isGsm7 = characters.every((character) => gsm7CharacterUnits(character) > 0);
  const unitLimit = isGsm7 ? 160 : 70;
  const characterUnits = (character: string) => (
    isGsm7 ? gsm7CharacterUnits(character) : character.length
  );
  const totalUnits = characters.reduce((total, character) => total + characterUnits(character), 0);

  if (totalUnits <= unitLimit && characters.length <= 160) return normalized;

  const ellipsisUnits = Array.from(SMS_ELLIPSIS).reduce(
    (total, character) => total + characterUnits(character),
    0,
  );
  let usedUnits = 0;
  let usedCharacters = 0;
  let compacted = "";

  for (const character of characters) {
    const units = characterUnits(character);
    if (
      usedUnits + units + ellipsisUnits > unitLimit
      || usedCharacters + 1 + SMS_ELLIPSIS.length > 160
    ) {
      break;
    }
    compacted += character;
    usedUnits += units;
    usedCharacters += 1;
  }

  return `${compacted.trimEnd()}${SMS_ELLIPSIS}`;
}