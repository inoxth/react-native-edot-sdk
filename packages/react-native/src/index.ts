// oxlint-disable-next-line typescript/triple-slash-reference -- ambient global declarations need to load
/// <reference path="./globals.d.ts" />

export { EdotReactNative } from './EdotReactNative';
export { EdotErrorBoundary } from './components/EdotErrorBoundary';
export { ActiveViewContext } from './activeViewContext';
export { withEdotTracking } from './interactions/with-edot-tracking';
export { useEdotAction } from './interactions/use-edot-action';
export { useEdot } from './hooks/useEdot';
export type { UseEdotResult } from './hooks/useEdot';
export type { ActiveView } from './activeViewContext';
export type {
  EdotConfig,
  EdotUser,
  TrackingConsent,
  EdotIosConfig,
  EdotAndroidConfig,
} from './types';
