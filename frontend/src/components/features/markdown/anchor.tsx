import React from "react";
import { ExtraProps } from "react-markdown";

export function anchor({
  href,
  children,
}: React.ClassAttributes<HTMLAnchorElement> &
  React.AnchorHTMLAttributes<HTMLAnchorElement> &
  ExtraProps) {
  // The agent is told about work hosts as http://localhost:<port>/…; from a phone
  // that is the phone. Same rewrite the app does for the sandbox URL: keep the
  // port and path, take scheme and host from the page.
  let target = href;
  if (href && typeof window !== "undefined") {
    try {
      const u = new URL(href);
      const pageHost = window.location.hostname;
      if (
        (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
        pageHost !== "localhost" &&
        pageHost !== "127.0.0.1"
      ) {
        u.protocol = window.location.protocol;
        u.hostname = pageHost;
        target = u.toString();
      }
    } catch {
      /* not a URL, leave it */
    }
  }
  return (
    <a
      className="text-blue-500 hover:underline"
      href={target}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}
