/**
 * Descanso utility functions for formatting and parsing rest time between sets.
 * Descanso is stored as seconds in the database, displayed as MM:SS in the UI.
 */

/**
 * Format seconds to MM:SS display format
 * @example
 * formatDescansoDisplay(60) => "1:00"
 * formatDescansoDisplay(90) => "1:30"
 * formatDescansoDisplay(45) => "0:45"
 */
export function formatDescansoDisplay(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Parse user input (MM:SS or seconds) to total seconds
 * @example
 * parseDescansoInput("1:30") => 90
 * parseDescansoInput(90) => 90
 * parseDescansoInput("0:45") => 45
 */
export function parseDescansoInput(input: string | number): number {
  if (typeof input === "number") {
    return input;
  }

  const trimmed = input.trim();
  
  // Handle MM:SS format
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);
      if (!isNaN(minutes) && !isNaN(seconds)) {
        return minutes * 60 + seconds;
      }
    }
  }

  // Handle plain number as seconds
  const num = parseInt(trimmed, 10);
  return !isNaN(num) ? num : 0;
}
