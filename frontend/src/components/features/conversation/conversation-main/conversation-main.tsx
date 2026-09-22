import { cn } from "#/utils/utils";
import { ChatInterfaceWrapper } from "./chat-interface-wrapper";
import { ConversationTabContent } from "../conversation-tabs/conversation-tab-content/conversation-tab-content";
import { ResizeHandle } from "../../../ui/resize-handle";
import { useResizablePanels } from "#/hooks/use-resizable-panels";
import { useConversationStore } from "#/stores/conversation-store";
import { useBreakpoint } from "#/hooks/use-breakpoint";

function getDesktopTabPanelClass(isRightPanelShown: boolean) {
  return isRightPanelShown
    ? "translate-x-0 opacity-100"
    : "w-0 translate-x-full opacity-0";
}

export function ConversationMain() {
  const isMobile = useBreakpoint();
  const { isRightPanelShown } = useConversationStore();

  const { leftWidth, rightWidth, isDragging, containerRef, handleMouseDown } =
    useResizablePanels({
      defaultLeftWidth: 50,
      minLeftWidth: 30,
      maxLeftWidth: 80,
      storageKey: "desktop-layout-panel-width",
    });

  return (
    <div
      className={cn(
        // min-h-0 down the chain: without it the thread's height pushed the composer past
        // the screen whenever no tab panel was open (the page then scrolled as a whole).
        isMobile
          ? "relative flex-1 min-h-0 flex flex-col overflow-hidden"
          : "h-full flex flex-col overflow-hidden",
      )}
    >
      <div
        ref={containerRef}
        className={cn(
          "flex flex-1 min-h-0 overflow-hidden",
          isMobile ? "flex-col" : "transition-all duration-300 ease-in-out",
        )}
        style={
          !isMobile
            ? { transitionProperty: isDragging ? "none" : "all" }
            : undefined
        }
      >
        {/* Chat Panel - always mounted, styled differently for mobile/desktop */}
        <div
          className={cn(
            "flex flex-col bg-base overflow-hidden",
            isMobile
              ? "flex-1 min-h-0"
              : "transition-all duration-300 ease-in-out",
          )}
          style={
            !isMobile
              ? {
                  width: isRightPanelShown ? `${leftWidth}%` : "100%",
                  transitionProperty: isDragging ? "none" : "all",
                }
              : undefined
          }
        >
          <ChatInterfaceWrapper
            isRightPanelShown={!isMobile && isRightPanelShown}
          />
        </div>

        {/* Resize Handle - only shown on desktop when right panel is visible */}
        {!isMobile && isRightPanelShown && (
          <ResizeHandle onMouseDown={handleMouseDown} />
        )}

        {/* Tab Content Panel - always mounted, styled as bottom sheet (mobile) or side panel (desktop) */}
        <div
          className={cn(
            "transition-all duration-300 ease-in-out overflow-hidden",
            // On a phone the tab (Planner, Changes, Terminal, ...) is a full-screen sheet over
            // the chat. It used to open 640 px down the page, below the fold, so "Read more"
            // and "View" looked like they did nothing (phone test 2026-09-22).
            isMobile
              ? cn(
                  "fixed inset-0 z-40 bg-base px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]",
                  isRightPanelShown
                    ? "translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-full opacity-0",
                )
              : getDesktopTabPanelClass(isRightPanelShown),
          )}
          style={
            !isMobile
              ? {
                  width: isRightPanelShown ? `${rightWidth}%` : "0%",
                  transitionProperty: isDragging ? "opacity, transform" : "all",
                }
              : undefined
          }
        >
          <div
            className={cn(
              isMobile
                ? "h-full flex flex-col gap-3"
                : "flex flex-col flex-1 gap-3 min-w-max h-full",
            )}
          >
            <ConversationTabContent />
          </div>
        </div>
      </div>
    </div>
  );
}
