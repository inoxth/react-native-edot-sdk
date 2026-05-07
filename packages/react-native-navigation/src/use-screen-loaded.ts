import { useEffect } from 'react';
import { markCurrentScreenLoaded } from './navigation-lifecycle';

export function useScreenLoaded(ready: boolean): void {
  useEffect(() => {
    if (ready) {
      markCurrentScreenLoaded();
    }
  }, [ready]);
}
