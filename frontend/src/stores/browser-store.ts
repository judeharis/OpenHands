import { create } from "zustand";

interface BrowserState {
  // URL of browser window (placeholder for now, will be replaced with the actual URL later)
  url: string;
  // Base64-encoded screenshot of browser window (placeholder for now, will be replaced with the actual screenshot later)
  screenshotSrc: string;
}

interface BrowserStore extends BrowserState {
  setUrl: (url: string) => void;
  setScreenshotSrc: (screenshotSrc: string) => void;
  reset: () => void;
}

const initialState: BrowserState = {
  // Fork: empty, not upstream's placeholder -- the tab showed github.com/OpenHands/OpenHands
  // over "no page loaded" in every conversation that had not browsed.
  url: "",
  screenshotSrc: "",
};

export const useBrowserStore = create<BrowserStore>((set) => ({
  ...initialState,
  setUrl: (url: string) => set({ url }),
  setScreenshotSrc: (screenshotSrc: string) => set({ screenshotSrc }),
  reset: () => set(initialState),
}));
