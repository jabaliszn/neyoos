/**
 * Template variable substitution (Feature A.7).
 * Replaces {{variable}} placeholders with provided values.
 * Unknown variables are left blank (and reported) so a missing field never
 * sends raw "{{x}}" to a parent.
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string | number | null | undefined>
): { text: string; missing: string[] } {
  const missing: string[] = [];
  const text = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    if (v === undefined || v === null || v === "") {
      missing.push(key);
      return "";
    }
    return String(v);
  });
  return { text, missing };
}
