import { useRef, useState } from 'react';

/**
 * Blocks a second click before React has re-rendered the disabled button.
 * `busy` is true from the click until the action finishes.
 */
export function useActionLock() {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await action();
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  /** Locks immediately. Returns false when a click is already in progress. */
  function hold() {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    return true;
  }

  function release() {
    locked.current = false;
    setBusy(false);
  }

  return { busy, run, hold, release };
}
