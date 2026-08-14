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
const listeners = new Set<() => void>();

async function load(): Promise<Set<OnboardingStep>> {
  if (seen) return seen;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    seen = new Set(raw ? (JSON.parse(raw) as OnboardingStep[]) : []);
  } catch {
    seen = new Set();
  }
  return seen;
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
 * never flashes in front of someone who already dismissed him.
 */
export function useOnboardingStep(step: OnboardingStep, enabled = true) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    const sync = () => {
      if (!alive) return;
      setShow(enabled && !(seen?.has(step) ?? true));
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

  return { show, dismiss };
}
