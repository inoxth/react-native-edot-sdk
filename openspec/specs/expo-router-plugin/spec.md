# expo-router-plugin

## Purpose

Integrates with Expo Router to automatically create view spans on route changes and maintain the ActiveViewContext, enabling network and error spans to be correlated to the current screen.

## Requirements

### Requirement: Expo Router navigation provider
The SDK SHALL provide `<EdotExpoNavigationProvider>` React component that wraps the app's content. It SHALL use `usePathname()` and `useSegments()` hooks from `expo-router` to detect route changes. It SHALL accept an optional `screenNameMapper` prop.

#### Scenario: Provider wraps app
- **WHEN** `<EdotExpoNavigationProvider>` wraps the app layout
- **THEN** it monitors pathname changes via `usePathname()`

### Requirement: View span creation on route change
The provider SHALL create a view span on each pathname change. It SHALL end the previous view span and create a new one with span name `Navigation: {pathname}`, using the last segment as `view.name`. Attributes SHALL include `view.name`, `view.previous`, `view.url` (full pathname).

#### Scenario: Route change creates span
- **WHEN** user navigates from `/home` to `/products/42`
- **THEN** the `/home` view span ends
- **AND** a new span `Navigation: /products/42` is created
- **AND** `view.name` is `/products/42`
- **AND** `view.previous` is `/home`
- **AND** `view.url` is `/products/42`

#### Scenario: Screen name mapper applied
- **WHEN** `screenNameMapper` is `(path) => path.replace(/\/\d+/g, '/:id')`
- **AND** user navigates to `/products/42`
- **THEN** the span name is `Navigation: /products/:id`

### Requirement: ActiveViewContext integration
The provider SHALL call `ActiveViewContext.setActiveView()` on each route change.

#### Scenario: Active view updated on route change
- **WHEN** user navigates to `/products/42`
- **THEN** `ActiveViewContext.getActiveView()` reflects the current route

### Requirement: Cleanup on unmount
The provider SHALL end the current view span and clear the active view context on unmount.

#### Scenario: Provider unmounts
- **WHEN** `<EdotExpoNavigationProvider>` unmounts
- **THEN** the current view span ends and active view context is cleared
