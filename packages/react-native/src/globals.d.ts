declare var global: typeof globalThis & {
  __turboModuleProxy?: object;
  nativeFabricUIManager?: object;
  HermesInternal?: {
    enablePromiseRejectionTracker?: (options: {
      allRejections: boolean;
      onUnhandled: (id: number, rejection: Error | unknown) => void;
    }) => void;
  };
};
