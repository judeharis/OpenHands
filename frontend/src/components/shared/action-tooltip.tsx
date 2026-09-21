import { Tooltip } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import { cn } from "#/utils/utils";

interface ActionTooltipProps {
  type: "confirm" | "reject";
  onClick: () => void;
}

export function ActionTooltip({ type, onClick }: ActionTooltipProps) {
  const { t } = useTranslation();

  const isConfirm = type === "confirm";

  const ariaLabel = isConfirm
    ? t(I18nKey.ACTION$CONFIRM)
    : t(I18nKey.ACTION$REJECT);

  const content = isConfirm
    ? t(I18nKey.CHAT_INTERFACE$USER_CONFIRMED)
    : t(I18nKey.CHAT_INTERFACE$USER_REJECTED);

  // Keyboard hints mean nothing on a phone and crowd the row; show them only
  // where a keyboard is likely (hover-capable, fine pointer).
  const hasKeyboard =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const shortcut = isConfirm ? " ⌘↩" : " ⇧⌘⌫";
  const buttonLabel = isConfirm
    ? `${t(I18nKey.CHAT_INTERFACE$INPUT_CONTINUE_MESSAGE)}${hasKeyboard ? shortcut : ""}`
    : `${t(I18nKey.BUTTON$CANCEL)}${hasKeyboard ? shortcut : ""}`;

  return (
    <Tooltip content={content} closeDelay={100}>
      <button
        data-testid={`action-${type}-button`}
        type="button"
        aria-label={ariaLabel}
        className={cn(
          "rounded px-4 min-h-9 text-sm font-medium leading-5 cursor-pointer hover:opacity-80",
          type === "confirm"
            ? "bg-tertiary text-white"
            : "bg-white text-[#0D0F11]",
        )}
        onClick={onClick}
      >
        {buttonLabel}
      </button>
    </Tooltip>
  );
}
