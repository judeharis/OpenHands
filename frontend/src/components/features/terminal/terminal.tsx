/* eslint-disable i18next/no-literal-string -- fork-only copy; not in translation.json, which upstream keeps complete */
import React from "react";
import { useTranslation } from "react-i18next";
import { useTerminal } from "#/hooks/use-terminal";
import "@xterm/xterm/css/xterm.css";
import { RUNTIME_INACTIVE_STATES } from "#/types/agent-state";
import { cn } from "#/utils/utils";
import { WaitingForRuntimeMessage } from "../chat/waiting-for-runtime-message";
import { useAgentState } from "#/hooks/use-agent-state";
import { I18nKey } from "#/i18n/declaration";
import { ShellTerminal } from "./shell-terminal";

// Fork: the tab holds two terminals -- a shell of your own in the sandbox, and upstream's
// read-only log of the agent's commands. The choice is remembered on this device.
type Mode = "shell" | "agent";
const MODE_KEY = "jentic:terminal-mode";

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "agent" ? "agent" : "shell";
  } catch {
    return "shell";
  }
}

function AgentLog({ hidden }: { hidden: boolean }) {
  const ref = useTerminal();
  return (
    <div className="flex-1 min-h-0 p-4">
      <div
        ref={ref}
        data-testid="agent-terminal-log"
        className={cn(
          "w-full h-full",
          hidden ? "p-0 w-0 h-0 opacity-0 overflow-hidden" : "",
        )}
      />
    </div>
  );
}

function Terminal() {
  const { t } = useTranslation();
  const { curAgentState, isArchived } = useAgentState();
  const [mode, setMode] = React.useState<Mode>(readMode);

  // Don't show runtime inactive state for archived conversations
  const isRuntimeInactive =
    !isArchived && RUNTIME_INACTIVE_STATES.includes(curAgentState);

  const choose = (next: Mode) => {
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // not remembered; still switched
    }
  };

  const modeButton = (value: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      data-testid={`terminal-mode-${value}`}
      onClick={() => choose(value)}
      className={cn(
        "h-8 rounded-md px-3 text-xs",
        mode === value
          ? "bg-neutral-600 text-white"
          : "text-neutral-400 hover:text-white",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col rounded-xl">
      <div role="tablist" className="flex gap-1 px-3 pt-2">
        {modeButton("shell", "Shell")}
        {modeButton("agent", "Agent log")}
      </div>
      {isArchived && (
        <div className="w-full h-full flex items-center text-center justify-center text-2xl text-tertiary-light pt-16">
          {t(I18nKey.CONVERSATION$ARCHIVED_READ_ONLY)}
        </div>
      )}
      {!isArchived && mode === "shell" && (
        <div className="flex-1 min-h-0">
          <ShellTerminal />
        </div>
      )}
      {mode === "agent" && (
        <>
          {!isArchived && isRuntimeInactive && (
            <WaitingForRuntimeMessage className="pt-16" />
          )}
          <AgentLog hidden={isRuntimeInactive || isArchived} />
        </>
      )}
    </div>
  );
}

export default Terminal;
