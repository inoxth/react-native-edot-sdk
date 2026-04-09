## 1. ActiveViewContext (Core Package)

- [x] 1.1 Create `packages/react-native/src/activeViewContext.ts` with `ActiveView` type, `setActiveView`, `getActiveView`, `clearActiveView`, and `addListener`
- [x] 1.2 Add subpath export `@inox/react-native-edot-sdk/active-view-context` in package.json `exports` field
- [x] 1.3 Write unit tests for ActiveViewContext (set/get/clear/listener/unsubscribe)

## 2. View Correlation (Core Package Modifications)

- [x] 2.1 Update `setupFetchInstrumentation` to read ActiveViewContext at request start and attach `view.name`/`view.id` attributes to network spans
- [x] 2.2 Update `setupXhrInstrumentation` with the same view correlation logic
- [x] 2.3 Update `setupErrorHandler` to attach `view.name` from ActiveViewContext to error spans
- [x] 2.4 Write unit tests for view correlation on fetch, XHR, and error spans

## 3. React Navigation Plugin Package

- [x] 3.1 Scaffold `packages/react-native-navigation/` with package.json, tsconfig, entry point (peer dep on `@react-navigation/native >=6.0.0`)
- [x] 3.2 Implement `createEdotNavigationContainerRef` with `screenNameMapper` support
- [x] 3.3 Implement `onStateChange` handler: end previous span, create new span with `view.name`/`view.previous`/`view.transition_type`, call `ActiveViewContext.setActiveView`
- [x] 3.4 Implement cleanup on unmount (end span, clear active view)
- [x] 3.5 Write unit tests for span creation, screen name mapping, cleanup

## 4. Wix Navigation Plugin Package

- [x] 4.1 Scaffold `packages/react-native-wix-navigation/` with package.json, tsconfig, entry point (peer dep on `react-native-navigation >=7.0.0`)
- [x] 4.2 Implement `registerEdotNavigationListener` with `ComponentDidAppear` listener, `screenNameMapper`, and cleanup function
- [x] 4.3 Implement span lifecycle (end previous, create new, update ActiveViewContext)
- [x] 4.4 Write unit tests for listener registration, span creation, cleanup

## 5. Expo Router Plugin Package

- [x] 5.1 Scaffold `packages/react-native-expo-router/` with package.json, tsconfig, entry point (peer dep on `expo-router >=3.0.0`)
- [x] 5.2 Implement `EdotExpoNavigationProvider` component using `usePathname`/`useSegments`, `screenNameMapper` prop
- [x] 5.3 Implement span lifecycle and ActiveViewContext updates on route change
- [x] 5.4 Implement cleanup on unmount
- [x] 5.5 Write unit tests for route change detection, span creation, cleanup

## 6. TracerProvider Package

- [x] 6.1 Scaffold `packages/react-native-tracer-provider/` with package.json, tsconfig, entry point
- [x] 6.2 Implement `getTracerProvider` → `TracerProvider` → `getTracer(name, version)` → `Tracer`
- [x] 6.3 Implement `Tracer.startSpan(name, options?)` delegating to `EdotNativeModule.startSpan`, returning `Span` object with `setAttribute`, `setStatus`, `recordException`, `end`, `spanId`
- [x] 6.4 Implement parent span support via `SpanOptions.parentSpan`
- [x] 6.5 Implement `withSpanContext(parentSpan, fn)` for async context propagation
- [x] 6.6 Implement `getMeterProvider` → `MeterProvider` → `getMeter(name, version)` → `Meter`
- [x] 6.7 Implement `Meter.createCounter`, `createHistogram`, `createUpDownCounter` delegating to `EdotNativeModule.recordMetric`
- [x] 6.8 Export `SpanStatusCode` enum (`OK = 1`, `ERROR = 2`)
- [x] 6.9 Write unit tests for TracerProvider, Tracer, Span, MeterProvider, Meter, withSpanContext

## 7. User Interactions (Core Package)

- [x] 7.1 Create `packages/react-native/src/interactions/withEdotTracking.tsx` HOC
- [x] 7.2 Create `packages/react-native/src/interactions/useEdotAction.ts` hook
- [x] 7.3 Export both from the core package entry point
- [x] 7.4 Write unit tests for withEdotTracking (auto-tracking, custom name, view context) and useEdotAction

## 8. Workspace Integration

- [x] 8.1 Add all new packages to root `package.json` workspaces
- [x] 8.2 Run `yarn install` to link workspace packages
- [x] 8.3 Verify TypeScript compilation across all packages (`tsc --noEmit`)
- [x] 8.4 Verify linting passes across all packages
- [x] 8.5 Run full test suite and fix any failures
