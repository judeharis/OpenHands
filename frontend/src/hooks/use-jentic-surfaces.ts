import { useConfig } from "#/hooks/query/use-config";
import { useShouldShowGitFeatures } from "#/hooks/use-should-show-git-features";

/**
 * Scheduled automations. The server flag defaults to on, but nothing in this
 * deployment drives a schedule yet, so the button opens an empty page. Flip this
 * when automations are actually wired up.
 */
const JENTIC_AUTOMATIONS = false;

/**
 * Which product surfaces this deployment can actually use.
 *
 * jentic runs as one local user on their own machine: no git provider, no
 * organisation, no billing, no email. Upstream renders those surfaces anyway —
 * "Open Repository", suggested repo tasks, Integrations, Verification,
 * Automations — and on a phone they are most of the screen. Hide what is not
 * configured rather than showing it broken; each one returns on its own once it
 * is configured (git from the settings store, email from the server config).
 */
export function useJenticSurfaces() {
  const { data: config } = useConfig();
  const git = useShouldShowGitFeatures();

  return {
    /** A git provider is connected: repo cards, branch chips, repo macros. */
    git,
    /** Email verification only exists where the server can send email. */
    verification: !!config?.email_enabled,
    /** Scheduled automations. */
    automations:
      JENTIC_AUTOMATIONS && !!config?.feature_flags?.enable_automations,
    /** Links into upstream's hosted product docs; this fork is not that product. */
    upstreamDocs: false,
  };
}
