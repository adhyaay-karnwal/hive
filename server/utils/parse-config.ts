/**
 * Safely parse configOverride from a project.
 * Handles object, string, double-stringified, and corrupted cases.
 */
export function parseConfig(configOverride: unknown): Record<string, any> {
  if (!configOverride) return {};

  if (typeof configOverride === "object" && configOverride !== null) {
    // Check if it's a valid config or a corrupted nested object
    // or if it's a corrupted nested object like {"0":"{","1":"\"", ...}
    const obj = configOverride as Record<string, any>;
    if ("0" in obj && "1" in obj) {
      // Corrupted - treat as empty
      return {};
    }
    return obj;
  }

  if (typeof configOverride === "string") {
    try {
      const parsed = JSON.parse(configOverride);
      if (typeof parsed === "string") {
        try {
          return JSON.parse(parsed);
        } catch {
          return {};
        }
      }
      if (typeof parsed === "object" && parsed !== null) {
        return parsed;
      }
    } catch {
      // unparseable
    }
  }

  return {};
}
