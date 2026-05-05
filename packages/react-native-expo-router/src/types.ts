export interface ExpoRouterRoute {
  name: string;
  params?: object;
}

export interface ExpoNavigationContainerRef {
  addListener: (event: 'state', listener: () => void) => () => void;
  getCurrentRoute: () => ExpoRouterRoute | undefined;
}

export interface EdotExpoNavigationProviderProps {
  navigationRef: ExpoNavigationContainerRef;
  screenNameMapper?: (routeName: string, params?: object) => string;
  children?: React.ReactNode;
}
