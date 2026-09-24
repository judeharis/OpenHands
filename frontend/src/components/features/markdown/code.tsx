import React from "react";
import { ExtraProps } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { CopyableContentWrapper } from "#/components/shared/buttons/copyable-content-wrapper";
import { CollapsibleCode } from "./collapsible-code";
import { ChoicePicker } from "#/components/features/chat/choice-picker";
import { parseChoices } from "#/utils/parse-choices";

const WRAP = {
  whiteSpace: "pre-wrap" as const,
  overflowWrap: "anywhere" as const,
  wordBreak: "break-word" as const,
};

// See https://github.com/remarkjs/react-markdown?tab=readme-ov-file#use-custom-components-syntax-highlight

/**
 * Component to render code blocks in markdown.
 */
export function code({
  children,
  className,
}: React.ClassAttributes<HTMLElement> &
  React.HTMLAttributes<HTMLElement> &
  ExtraProps) {
  const match = /language-(\w+)/.exec(className || ""); // get the language
  const codeString = String(children).replace(/\n$/, "");

  // An agent asking the user to pick (jentic/AGENTS.md.tmpl): a picker, not code. A block
  // that does not parse falls through and shows as the code it is.
  if (match?.[1] === "choices") {
    const questions = parseChoices(codeString);
    if (questions) return <ChoicePicker questions={questions} raw={codeString} />;
  }

  if (!match) {
    const isMultiline = String(children).includes("\n");

    if (!isMultiline) {
      return (
        <code
          className={className}
          style={{
            backgroundColor: "#2a3038",
            padding: "0.2em 0.4em",
            borderRadius: "4px",
            color: "#e6edf3",
            border: "1px solid #30363d",
            // An inline `cd /long/path && python -c "..."` is one unbreakable run to
            // the layout: the paragraph wrapped, the code ran 140 px off the right
            // edge of a 384 px phone and the tail of the command was unreadable.
            ...WRAP,
          }}
        >
          {children}
        </code>
      );
    }

    return (
      <CopyableContentWrapper text={codeString}>
        <CollapsibleCode code={codeString}>
          {(shown) => (
            <pre
              style={{
                backgroundColor: "#2a3038",
                padding: "1em",
                borderRadius: "4px",
                color: "#e6edf3",
                border: "1px solid #30363d",
                overflow: "auto",
                // wrap long lines: on a phone a clipped command is a command you
                // approve without having read it
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              <code className={className}>{shown}</code>
            </pre>
          )}
        </CollapsibleCode>
      </CopyableContentWrapper>
    );
  }

  return (
    <CopyableContentWrapper text={codeString}>
      <CollapsibleCode code={codeString} label={match?.[1]}>
        {(shown) => (
          <SyntaxHighlighter
            className="rounded-lg"
            style={vscDarkPlus}
            language={match?.[1]}
            PreTag="div"
            // Same reason as the unhighlighted branch above: on a phone a command
            // that runs off the right edge is a command approved unread, and a
            // horizontal scrollbar inside a vertical thread is not discoverable.
            wrapLongLines
            customStyle={WRAP}
            codeTagProps={{ style: WRAP }}
          >
            {shown}
          </SyntaxHighlighter>
        )}
      </CollapsibleCode>
    </CopyableContentWrapper>
  );
}
