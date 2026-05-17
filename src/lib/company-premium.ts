export const COMPANY_MODE_UNLOCK_CODE = "MAMAT-METAL";

export function isValidCompanyUnlockCode(code: string) {
  return code.trim() === COMPANY_MODE_UNLOCK_CODE;
}

export function normalizeQuotationPrefix(input: string) {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
