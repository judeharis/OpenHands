import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import {
  DEFAULT_PROJECT_DIR,
  DEFAULT_WORKSPACE,
  pathUnder,
} from "#/utils/llmkit-policy";

interface WorkspacePathProps {
  path: string;
  projectDir?: string;
  workspace?: string;
  className?: string;
}

/**
 * A path as a phone user should read it: the project prefix greyed, the part
 * that matters bright, and anything outside the workspace in red with a word.
 */
export function WorkspacePath({
  path,
  projectDir = DEFAULT_PROJECT_DIR,
  workspace = DEFAULT_WORKSPACE,
  className,
}: WorkspacePathProps) {
  const { t } = useTranslation();
  if (!pathUnder(path, workspace, projectDir)) {
    return (
      <span className={className} data-testid="workspace-path-outside">
        <span className="text-red-400 font-mono break-all">{path}</span>{" "}
        <span className="text-red-400">
          ({t(I18nKey.POLICY$OUTSIDE_WORKSPACE)})
        </span>
      </span>
    );
  }
  const prefix = `${projectDir}/`;
  const rest = path.startsWith(prefix) ? path.slice(prefix.length) : null;
  return (
    <span className={`font-mono break-all ${className ?? ""}`}>
      {rest !== null ? (
        <>
          <span className="text-neutral-500">{prefix}</span>
          <span className="text-white">{rest}</span>
        </>
      ) : (
        <span className="text-white">{path}</span>
      )}
    </span>
  );
}
