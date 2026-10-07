import { StyledTooltip } from "#/components/shared/buttons/styled-tooltip";
import { JENTIC_MODELS_PATH } from "#/hooks/use-jentic-models-page";

/** jentic-x only: the Models page, served beside the app (a full page, not a route). */
export function JenticModelsButton() {
  const label = "Models";
  return (
    <StyledTooltip content={label} placement="right">
      <a
        href={JENTIC_MODELS_PATH}
        data-testid="jentic-models-button"
        aria-label={label}
        className="inline-flex items-center justify-center"
      >
        <svg
          width={24}
          height={24}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" />
          <path d="m3 12 9 4.5 9-4.5" />
          <path d="m3 16.5 9 4.5 9-4.5" />
        </svg>
      </a>
    </StyledTooltip>
  );
}
