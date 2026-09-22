import type { TFunction } from "i18next";
import { I18nKey } from "#/i18n/declaration";
import { DEFAULT_PROJECT_DIR } from "#/utils/llmkit-policy";

/** "write:/workspace/project/t3/" -> "writes under t3/" */
export function describeGrant(grant: string, t: TFunction): string {
  const idx = grant.indexOf(":");
  const form = grant.slice(0, idx);
  const value = grant.slice(idx + 1);
  switch (form) {
    case "write": {
      const prefix = `${DEFAULT_PROJECT_DIR}/`;
      const dir = value.startsWith(prefix) ? value.slice(prefix.length) : value;
      return t(I18nKey.POLICY$GRANT_WRITE, { dir: dir || "the project" });
    }
    case "cmd":
      return t(I18nKey.POLICY$GRANT_CMD, { cmd: value });
    case "tool":
      return t(I18nKey.POLICY$GRANT_TOOL, { tool: value });
    case "kind":
      return t(I18nKey.POLICY$GRANT_KIND, { kind: value });
    case "view":
      return t(I18nKey.POLICY$GRANT_VIEW);
    default:
      return grant;
  }
}
