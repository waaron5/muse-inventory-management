/** A tool's answer to the AI, as JSON. */
export function answer(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

/** A tool's refusal, in words the AI passes on. */
export function refused(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
