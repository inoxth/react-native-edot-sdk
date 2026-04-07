import { useCallback } from 'react';
import { ActiveViewContext } from '../activeViewContext';
import { EdotNativeModule } from '../nativeModule';

interface UseEdotActionReturn {
  trackAction(
    type: string,
    name: string,
    attributes?: Record<string, string | number | boolean>,
  ): void;
}

export function useEdotAction(): UseEdotActionReturn {
  const trackAction = useCallback(
    (
      type: string,
      name: string,
      attributes?: Record<string, string | number | boolean>,
    ): void => {
      const activeView = ActiveViewContext.getActiveView();
      const merged: Record<string, string | number | boolean> = {
        'user_action.type': type,
        'user_action.target': name,
        ...attributes,
      };
      if (activeView) {
        merged['view.name'] = activeView.name;
      }

      EdotNativeModule.emitLog('info', `UserAction: ${name}`, merged);
    },
    [],
  );

  return { trackAction };
}
