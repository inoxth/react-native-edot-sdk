import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export function withSafeAreaProvider<P extends object>(
  Component: React.ComponentType<P>,
): React.ComponentType<P> {
  return function SafeAreaWrapped(props: P): React.JSX.Element {
    return (
      <SafeAreaProvider>
        <Component {...props} />
      </SafeAreaProvider>
    );
  };
}
