import { useCallback, useEffect, useState } from 'react';
import {
  getAppUpdateState,
  refreshApp,
  subscribeAppUpdate,
  type AppUpdateState,
} from '../liveUpdate';

export function useAppUpdate() {
  const [updateState, setUpdateState] = useState<AppUpdateState>(() => getAppUpdateState());

  useEffect(() => subscribeAppUpdate(setUpdateState), []);

  const refresh = useCallback(async () => {
    await refreshApp();
  }, []);

  return { updateState, refresh };
}
