import { useCallback, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

/**
 * What the coach has already said, tracked one step at a time (#68).
 *
 * Per-step rather than a single "onboarded" flag on purpose: skipping the
 * intro must not cost you the line that explains the vote slider three days
 * later. Skipping one step skips that step, nothing else.
 *
 * Server sync is deliberately not here. `userbase_users.onboarding_step` exists
 * and would survive a reinstall, but nothing writes it — the API only reads the
 * field (`lib/userbase/api.ts`). Local-only until that endpoint exists; the
 * cost of being wrong is the coach repeating himself on a new phone.
 */

const KEY = "onboarding_seen";

export type OnboardingStep = "intro" | "vote" | "map";

let seen: Set<OnboardingStep> | null = null;
// One in-flight read, shared. Two callers racing the first load would each get
// their own Set, and whichever wrote second would drop the other's dismissal,
// bringing that coach back.
let loading: Promise<Set<OnboardingStep>> | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<Set<OnboardingStep>> {
  if (seen) return seen;
  if (!loading) {
    loading = (async () => {
      try {
        const raw = await SecureStore.getItemAsync(KEY);
        seen = new Set(raw ? (JSON.parse(raw) as OnboardingStep[]) : []);
      } catch {
        seen = new Set();
      }
      return seen;
    })();
  }
  return loading;
}

export async function markStepSeen(step: OnboardingStep): Promise<void> {
  const set = await load();
  if (set.has(step)) return;
  set.add(step);
  listeners.forEach((l) => l());
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify([...set]));
  } catch {
    // Forgetting is survivable — he says it once more, that's all.
  }
}

/**
 * `show` stays false until the stored set has actually loaded, so the coach
 * never flashes in front of someone who already dismissed him. `ready` says
 * whether that load has happened: until it has, "not showing" means "don't
 * know yet", and a caller deciding where to navigate has to wait for it.
 */
export function useOnboardingStep(step: OnboardingStep, enabled = true) {
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(seen !== null);

  useEffect(() => {
    let alive = true;
    const sync = () => {
      if (!alive) return;
      setShow(enabled && !(seen?.has(step) ?? true));
      setReady(seen !== null);
    };
    listeners.add(sync);
    load().then(sync);
    return () => {
      alive = false;
      listeners.delete(sync);
    };
  }, [step, enabled]);

  const dismiss = useCallback(() => {
    setShow(false);
    void markStepSeen(step);
  }, [step]);

  return { show, ready, dismiss };
}
