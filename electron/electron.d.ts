export {};

declare global {
  interface Window {
    electronAPI?: {
      openDirectory: () => Promise<string | null>;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
    };
  }
}
