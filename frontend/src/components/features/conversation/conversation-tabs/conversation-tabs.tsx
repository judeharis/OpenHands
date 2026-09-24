import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import TerminalIcon from "#/icons/terminal.svg?react";
import GlobeIcon from "#/icons/globe.svg?react";
import GitChanges from "#/icons/git_changes.svg?react";
import VSCodeIcon from "#/icons/vscode.svg?react";
import ThreeDotsVerticalIcon from "#/icons/three-dots-vertical.svg?react";
import LessonPlanIcon from "#/icons/lesson-plan.svg?react";
import DoubleCheckIcon from "#/icons/double-check.svg?react";
import ClockIcon from "#/icons/u-clock-three.svg?react";
import { cn } from "#/utils/utils";
import { useConversationLocalStorageState } from "#/utils/conversation-local-storage";
import { ConversationTabNav } from "./conversation-tab-nav";
import { ChatActionTooltip } from "../../chat/chat-action-tooltip";
import { I18nKey } from "#/i18n/declaration";
import { VSCodeTooltipContent } from "./vscode-tooltip-content";
import { useConversationStore } from "#/stores/conversation-store";
import { ConversationTabsContextMenu } from "./conversation-tabs-context-menu";
import { useConversationId } from "#/hooks/use-conversation-id";
import { useSelectConversationTab } from "#/hooks/use-select-conversation-tab";
import { useTaskList } from "#/hooks/use-task-list";
import { useBreakpoint } from "#/hooks/use-breakpoint";

export function ConversationTabs() {
  const { conversationId } = useConversationId();
  const { setHasRightPanelToggled, setSelectedTab } = useConversationStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { state: persistedState, setRightPanelShown } =
    useConversationLocalStorageState(conversationId);
  const isMobile = useBreakpoint();

  // On a phone the panel is a full-screen sheet, so a conversation must open on the chat:
  // the remembered "panel shown" (a side panel on a desktop, and true by default) would
  // otherwise cover it on arrival. Reset once per arrival; taps open the sheet as usual.
  const arrivedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isMobile || arrivedFor.current === conversationId) return;
    arrivedFor.current = conversationId;
    if (persistedState.rightPanelShown) setRightPanelShown(false);
    setHasRightPanelToggled(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, conversationId]);

  const { hasTaskList } = useTaskList();

  const {
    selectTab,
    isTabActive,
    onTabChange,
    selectedTab,
    isRightPanelShown,
  } = useSelectConversationTab();

  // Initialize Zustand state from localStorage on component mount
  useEffect(() => {
    // Initialize selectedTab from localStorage if available
    setSelectedTab(persistedState.selectedTab);
    setHasRightPanelToggled(persistedState.rightPanelShown);
  }, [
    setSelectedTab,
    setHasRightPanelToggled,
    persistedState.selectedTab,
    persistedState.rightPanelShown,
  ]);

  useEffect(() => {
    const handlePanelVisibilityChange = () => {
      if (isRightPanelShown) {
        // If no tab is selected, default to editor tab
        if (!selectedTab) {
          onTabChange("editor");
        }
      }
    };

    handlePanelVisibilityChange();
  }, [isRightPanelShown, selectedTab, onTabChange]);

  const { t } = useTranslation();

  const tabs = [
    {
      tabValue: "planner",
      isActive: isTabActive("planner"),
      icon: LessonPlanIcon,
      onClick: () => selectTab("planner"),
      tooltipContent: t(I18nKey.COMMON$PLANNER),
      tooltipAriaLabel: t(I18nKey.COMMON$PLANNER),
      label: t(I18nKey.COMMON$PLANNER),
    },
    {
      tabValue: "editor",
      isActive: isTabActive("editor"),
      icon: GitChanges,
      onClick: () => selectTab("editor"),
      tooltipContent: t(I18nKey.COMMON$CHANGES),
      tooltipAriaLabel: t(I18nKey.COMMON$CHANGES),
      label: t(I18nKey.COMMON$CHANGES),
    },
    {
      tabValue: "vscode",
      isActive: isTabActive("vscode"),
      icon: VSCodeIcon,
      onClick: () => selectTab("vscode"),
      tooltipContent: <VSCodeTooltipContent />,
      tooltipAriaLabel: t(I18nKey.COMMON$CODE),
      label: t(I18nKey.COMMON$CODE),
    },
    {
      tabValue: "terminal",
      isActive: isTabActive("terminal"),
      icon: TerminalIcon,
      onClick: () => selectTab("terminal"),
      tooltipContent: t(I18nKey.COMMON$TERMINAL),
      tooltipAriaLabel: t(I18nKey.COMMON$TERMINAL),
      label: t(I18nKey.COMMON$TERMINAL),
      className: "pl-2",
    },
    {
      // Fork-only tab: what this conversation cost in time and tokens.
      tabValue: "stats",
      isActive: isTabActive("stats"),
      icon: ClockIcon,
      onClick: () => selectTab("stats"),
      tooltipContent: "Stats",
      tooltipAriaLabel: "Stats",
      label: "Stats",
    },
    {
      tabValue: "browser",
      isActive: isTabActive("browser"),
      icon: GlobeIcon,
      onClick: () => selectTab("browser"),
      tooltipContent: t(I18nKey.COMMON$BROWSER),
      tooltipAriaLabel: t(I18nKey.COMMON$BROWSER),
      label: t(I18nKey.COMMON$BROWSER),
    },
  ];

  if (hasTaskList) {
    tabs.unshift({
      tabValue: "tasklist",
      isActive: isTabActive("tasklist"),
      icon: DoubleCheckIcon,
      onClick: () => selectTab("tasklist"),
      tooltipContent: t(I18nKey.COMMON$TASK_LIST),
      tooltipAriaLabel: t(I18nKey.COMMON$TASK_LIST),
      label: t(I18nKey.COMMON$TASK_LIST),
    });
  }

  // Filter out unpinned tabs
  const visibleTabs = tabs.filter(
    (tab) => !persistedState.unpinnedTabs.includes(tab.tabValue),
  );

  // Fork: which ends of the scrolling strip have tabs beyond them, so the strip can fade
  // there. On a phone half the tabs are out of view, and a strip that simply stops
  // gives no sign there is more.
  const stripRef = useRef<HTMLDivElement>(null);
  const [moreBefore, setMoreBefore] = useState(false);
  const [moreAfter, setMoreAfter] = useState(false);
  const updateEdges = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const max = strip.scrollWidth - strip.clientWidth;
    setMoreBefore(strip.scrollLeft > 1);
    setMoreAfter(strip.scrollLeft < max - 1);
  }, []);

  // The open tab grows a label; bring it into the strip's view rather than leave the
  // tab the sheet belongs to scrolled out of sight.
  useEffect(() => {
    const strip = stripRef.current;
    const tab =
      isRightPanelShown && selectedTab
        ? strip?.querySelector(
            `[data-testid="conversation-tab-${selectedTab}"]`,
          )
        : null;
    if (strip && tab) {
      const s = strip.getBoundingClientRect();
      const r = tab.getBoundingClientRect();
      if (r.left < s.left) strip.scrollLeft -= s.left - r.left;
      else if (r.right > s.right) strip.scrollLeft += r.right - s.right;
    }
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [selectedTab, isRightPanelShown, visibleTabs.length, updateEdges]);

  const fade = "black calc(100% - 20px), transparent";
  let edgeMask: string | undefined;
  if (moreBefore && moreAfter)
    edgeMask = `linear-gradient(to right, transparent, black 20px, ${fade})`;
  else if (moreBefore)
    edgeMask = "linear-gradient(to right, transparent, black 20px)";
  else if (moreAfter) edgeMask = `linear-gradient(to right, ${fade})`;

  return (
    <div
      className={cn(
        // Shares one row with the title on a phone (the title truncates); a second header
        // row cost 15 % of the viewport. Scrolls sideways there rather than wrapping the
        // ⋮ menu onto a third line.
        // 62 % of a 384 px phone left the conversation title 65 px -- "✨ Vi...".
        // Below sm the strip keeps under half the row and scrolls; the title,
        // which is the only thing naming the conversation, gets the rest.
        // On a desktop too: lg:w-full (upstream's, from when the tabs had a row of their
        // own) took the whole row, left the title 0 px wide under the strip and pushed
        // the ⋮ 12 px past the edge, where it could not be clicked (1600 px, 2026-09-23).
        "relative w-auto max-w-[50%] sm:max-w-[62%] shrink-0 lg:w-auto lg:max-w-none",
        "flex flex-row items-center gap-3 lg:gap-4.5 min-w-0",
      )}
    >
      {/* Fork: end-safe, not end. Right-aligned tabs that overflow spill off the left,
          which a scroller cannot scroll to: on a 384 px phone Planner, Changes and Code
          sat left of the strip with a scroll range of 0 (2026-09-23). Safe alignment
          starts an overflowing strip at its first tab and scrolls to the rest; the ⋮
          sits outside the scroller, so it is always in reach. */}
      <div
        ref={stripRef}
        onScroll={updateEdges}
        data-testid="conversation-tab-strip"
        className="flex flex-row justify-end-safe items-center gap-3 lg:gap-4.5 flex-nowrap overflow-x-auto lg:flex-wrap min-w-0"
        style={
          edgeMask
            ? { maskImage: edgeMask, WebkitMaskImage: edgeMask }
            : undefined
        }
      >
        {visibleTabs.map(
          (
            {
              tabValue,
              icon,
              onClick,
              isActive,
              tooltipContent,
              tooltipAriaLabel,
              label,
              className,
            },
            index,
          ) => (
            <ChatActionTooltip
              key={index}
              tooltip={tooltipContent}
              ariaLabel={tooltipAriaLabel}
            >
              <ConversationTabNav
                tabValue={tabValue}
                icon={icon}
                onClick={onClick}
                isActive={isActive}
                label={label}
                className={className}
              />
            </ChatActionTooltip>
          ),
        )}
      </div>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={cn(
            "p-1 pl-0 rounded-md cursor-pointer",
            "text-[#9299AA] bg-[#0D0F11]",
          )}
          aria-label={t(I18nKey.COMMON$MORE_OPTIONS)}
        >
          <ThreeDotsVerticalIcon className={cn("w-5 h-5 text-inherit")} />
        </button>
        <ConversationTabsContextMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
        />
      </div>
    </div>
  );
}
