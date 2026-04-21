export interface NavigationRoute {
  name: string;
  key: string;
  params?: object;
}

export interface NavigationContainerRef {
  getCurrentRoute(): NavigationRoute | undefined;
}

export interface EdotNavigationOptions {
  screenNameMapper?: (routeName: string, params?: object) => string;
}
