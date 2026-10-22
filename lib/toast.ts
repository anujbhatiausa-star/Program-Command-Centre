export type ToastKind = "success" | "error" | "info";

/** Fire-and-forget toast; rendered by <LiveUpdates /> in the app shell. */
export function toast(message: string, kind: ToastKind = "success") {
  window.dispatchEvent(new CustomEvent("pcc-toast", { detail: { message, kind } }));
}
