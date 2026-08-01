"use client";

import { useSyncExternalStore } from "react";

import { heroScenarios } from "./hero-scenarios";

let selectedScenarioIndex = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) selectedScenarioIndex = 0;
  };
}

export function setMatchingScenario(index: number) {
  if (index === selectedScenarioIndex || !heroScenarios[index]) return;
  selectedScenarioIndex = index;
  listeners.forEach((listener) => listener());
}

export function useMatchingScenario() {
  const scenarioIndex = useSyncExternalStore(
    subscribe,
    () => selectedScenarioIndex,
    () => 0,
  );
  return [
    heroScenarios[scenarioIndex],
    scenarioIndex,
    setMatchingScenario,
  ] as const;
}
