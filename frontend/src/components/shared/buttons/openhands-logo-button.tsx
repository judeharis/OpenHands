import { NavLink } from "react-router";
import { StyledTooltip } from "#/components/shared/buttons/styled-tooltip";

// This fork ships as jentic, so the header wears its own wordmark rather than
// upstream's logo. Same link target (home) and same slot in the sidebar.
const WORDMARK = "jentic";

export function OpenHandsLogoButton() {
  return (
    <StyledTooltip content={WORDMARK}>
      <NavLink to="/" aria-label={WORDMARK}>
        <span className="text-white text-[17px] leading-6 font-semibold tracking-tight">
          {WORDMARK}
        </span>
      </NavLink>
    </StyledTooltip>
  );
}
