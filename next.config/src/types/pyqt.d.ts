export {};

declare global {
  interface Window {
    pyqtAPI?: {
      isPyQt: boolean | (() => boolean);
      showEmbedded: (
        x: number,
        y: number,
        w: number,
        h: number,
        url: string,
        id?: string,
      ) => void;
      updateEmbeddedBounds: (x: number, y: number, w: number, h: number, id?: string) => void;
      navigateEmbedded: (url: string, id?: string) => void;
      hideEmbedded: (id?: string) => void;
      embeddedBack: (id?: string) => void;
      embeddedForward: (id?: string) => void;
      embeddedReload: (id?: string) => void;
      embeddedStop: (id?: string) => void;
      openInNewTab: (url: string, label?: string) => void;
      normalizeUrl: (url: string) => string;
    };
    __pyqtChannelReady?: boolean;
  }
}
