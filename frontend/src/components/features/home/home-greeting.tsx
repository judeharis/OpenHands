import React from "react";

// Fork-only copy: these strings exist in this fork alone, so they are not in
// translation.json (which upstream keeps complete across every locale).
const SUBTITLE = "Ask for anything in your workspace.";

const greetingFor = (hour: number): string => {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

/**
 * The home screen opens on a greeting rather than a product headline, the way a
 * phone chat app does: it is the same screen every day, so it should read as a
 * place to start typing, not a landing page.
 */
export function HomeGreeting() {
  // Fixed at mount; the greeting flipping mid-session would be noise.
  const [greeting] = React.useState(() => greetingFor(new Date().getHours()));

  return (
    <div className="flex flex-col gap-1" data-testid="home-greeting">
      <h1 className="text-[28px] leading-9 font-semibold text-white">
        {greeting}
      </h1>
      <p className="text-sm leading-5 text-[#A3A3A3]">{SUBTITLE}</p>
    </div>
  );
}
