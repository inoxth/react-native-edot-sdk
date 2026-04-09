interface ErrorUtilsLike {
  getGlobalHandler(): (error: Error, isFatal: boolean) => void;
  setGlobalHandler(handler: (error: Error, isFatal: boolean) => void): void;
}

declare var global: typeof globalThis & {
  __turboModuleProxy?: object;
  nativeFabricUIManager?: object;
  HermesInternal?: {
    enablePromiseRejectionTracker?: (options: {
      allRejections: boolean;
      onUnhandled: (id: number, rejection: unknown) => void;
    }) => void;
  };
  ErrorUtils?: ErrorUtilsLike;
};
