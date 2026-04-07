import React, { useCallback } from 'react';
import { ActiveViewContext } from '../activeViewContext';
import { EdotNativeModule } from '../nativeModule';

interface TrackableProps {
  onPress?: (...args: unknown[]) => void;
}

export function withEdotTracking<P extends TrackableProps>(
  WrappedComponent: React.ComponentType<P>,
  actionName?: string,
): React.ComponentType<P> {
  const displayName =
    actionName ??
    WrappedComponent.displayName ??
    WrappedComponent.name ??
    'Unknown';

  function TrackedComponent(props: P): React.ReactElement {
    const handlePress = useCallback(
      (...args: unknown[]) => {
        const activeView = ActiveViewContext.getActiveView();
        const attributes: Record<string, string> = {};
        if (activeView) {
          attributes['view.name'] = activeView.name;
        }

        EdotNativeModule.emitLog('info', `UserAction: ${displayName}`, {
          'user_action.type': 'tap',
          'user_action.target': displayName,
          ...attributes,
        });

        props.onPress?.(...args);
      },
      [props.onPress],
    );

    return React.createElement(WrappedComponent, {
      ...props,
      onPress: handlePress,
    });
  }

  TrackedComponent.displayName = `withEdotTracking(${displayName})`;

  return TrackedComponent;
}
