export interface NavigationRoute {
  name: string;
  key: string;
  params?: object;
}

export interface NavigationContainerRefLike {
  addListener: (event: 'state', listener: () => void) => () => void;
  getCurrentRoute: () => NavigationRoute | undefined;
}

export interface WixComponentDidAppearEvent {
  componentName: string;
  componentId: string;
  passProps?: Record<string, unknown>;
}

export interface WixNavigationEvents {
  registerComponentDidAppearListener: (callback: (event: WixComponentDidAppearEvent) => void) => {
    remove: () => void;
  };
}

export interface WixNavigationLike {
  events: () => WixNavigationEvents;
}

export type RefScreenNameMapper = (routeName: string, params?: object) => string;
export type WixScreenNameMapper = (componentName: string) => string;

export interface EdotWixNavigationOptions {
  screenNameMapper?: WixScreenNameMapper;
}
