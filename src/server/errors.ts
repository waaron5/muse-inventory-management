/**
 * An expected outcome a command refuses with: bad input, nobody signed in, or a
 * role that may not do this. These are shown to the person, never reported as
 * errors.
 */
export class CommandError extends Error {
  constructor(
    readonly code: "invalid" | "not-signed-in" | "not-allowed",
    message: string,
  ) {
    super(message);
    this.name = "CommandError";
  }
}
