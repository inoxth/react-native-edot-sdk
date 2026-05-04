export interface ComponentDidAppearEvent {
  componentName: string;
  componentId: string;
  passProps?: Record<string, unknown>;
}

export interface NavigationEvents {
  registerComponentDidAppearListener(callback: (event: ComponentDidAppearEvent) => void): {
    remove(): void;
  };
}

export interface WixNavigation {
  events(): NavigationEvents;
}

export interface EdotWixNavigationOptions {
  screenNameMapper?: (componentName: string) => string;
}
