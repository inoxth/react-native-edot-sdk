export interface NavigationRoute {
  name: string;
  key: string;
  params?: Record<string, unknown>;
}

export interface NavigationContainerRef {
  getCurrentRoute(): NavigationRoute | undefined;
  addListener(event: string, callback: () => void): () => void;
}

export interface EdotNavigationOptions {
  screenNameMapper?: (routeName: string, params?: Record<string, unknown>) => string;
}
