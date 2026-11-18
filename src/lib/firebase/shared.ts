/** Project id used by the local Firebase emulators ("demo-" ids never reach a real project). */
export const EMULATOR_PROJECT_ID = "demo-dourya";

/** True when a value is missing or still the template placeholder. */
export function isPlaceholder(value: string | undefined): boolean {
  return !value || value.includes("REPLACE_ME");
}
