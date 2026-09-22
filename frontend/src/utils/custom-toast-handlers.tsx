import { CSSProperties } from "react";
import toast, { ToastOptions } from "react-hot-toast";
import { calculateToastDuration } from "./toast-duration";
import i18n from "#/i18n";

export const TOAST_STYLE: CSSProperties = {
  background: "#454545",
  border: "1px solid #717888",
  color: "#fff",
  borderRadius: "4px",
  maxWidth: "400px",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
  whiteSpace: "pre-wrap",
};

// Bottom, not over the header buttons: on a phone a toast at the top covered the
// mode switch and the ⋮ menu (phone UX study, item 14).
export const TOAST_OPTIONS: ToastOptions = {
  position: "bottom-center",
  style: TOAST_STYLE,
};

export const displayErrorToast = (error: string | null | undefined) => {
  const errorMessage = error || i18n.t("STATUS$ERROR");
  const duration = calculateToastDuration(errorMessage, 4000);
  toast.error(
    <span style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
      {errorMessage}
    </span>,
    { ...TOAST_OPTIONS, duration },
  );
};

export const displaySuccessToast = (message: string) => {
  const duration = calculateToastDuration(message, 5000);
  toast.success(
    <span style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
      {message}
    </span>,
    { ...TOAST_OPTIONS, duration },
  );
};
