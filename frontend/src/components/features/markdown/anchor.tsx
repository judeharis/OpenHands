import React from "react";
import { ExtraProps } from "react-markdown";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";

function OpenButton({ target }: { target: string }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-testid="open-work-host"
      onClick={(e) => {
        e.preventDefault();
        window.open(target, "_blank", "noopener");
      }}
      className="ml-2 align-middle rounded px-2 min-h-7 text-xs font-medium bg-white text-black cursor-pointer"
    >
      {t(I18nKey.MARKDOWN$OPEN_LINK)}
    </button>
  );
}

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
  // A dev server or a published build is what the user came for: give it a button
  // that opens in a new tab, not only a link to find in the prose (item 15).
  const isWorkHost =
    !!target &&
    (target !== href || /\/sb\/\d+\/|\/games\/[^/]+\/?/.test(target));
  return (
    <>
      <a
        className="text-blue-500 hover:underline"
        href={target}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
      {isWorkHost && target && <OpenButton target={target} />}
    </>
  );
}
