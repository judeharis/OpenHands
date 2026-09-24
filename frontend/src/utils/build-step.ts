/** Said first to every code agent a planner hands over to: it IS the Build step. */
export const BUILD_PREAMBLE =
  "You are the code agent, and this message is the Build step: nothing else needs clicking or " +
  "approving first. Carry the plan out with your tools. The planner's text may mention a Build " +
  "button or switching agents; that was addressed to the user and is already done.";

/** A Build-step message: the chat does not show it, since the switch is not the user's words. */
export const isBuildStepText = (text: string): boolean =>
  text.startsWith(BUILD_PREAMBLE);
