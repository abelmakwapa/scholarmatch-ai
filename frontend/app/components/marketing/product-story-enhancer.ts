import { animate } from "motion/mini";

import { motionDurations } from "@/app/lib/motion/tokens";

type StopControl = { stop: () => void };

function canAnimate() {
  return (
    document.visibilityState === "visible" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function reveal(element: Element, controls: StopControl[]) {
  if (!canAnimate()) return;
  controls.push(
    animate(
      element,
      { opacity: [0.72, 1], transform: ["translateY(8px)", "translateY(0)"] },
      { duration: motionDurations.standard },
    ),
  );
}

function enhanceTabs(
  group: HTMLElement,
  cleanup: Array<() => void>,
  controls: StopControl[],
) {
  const tabs = Array.from(
    group.querySelectorAll<HTMLButtonElement>("[data-tab]"),
  );
  const root = group.parentElement;
  const panels = root
    ? Array.from(root.querySelectorAll<HTMLElement>("[data-panel]"))
    : [];

  const activate = (index: number, focus = false) => {
    tabs.forEach((tab, tabIndex) => {
      const active = tabIndex === index;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel, panelIndex) => {
      panel.hidden = panelIndex !== index;
      if (panelIndex === index) reveal(panel, controls);
    });
    if (focus) tabs[index]?.focus();
  };

  tabs.forEach((tab, index) => {
    const onClick = () => activate(index);
    const onKeyDown = (event: KeyboardEvent) => {
      let next: number | null = null;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft")
        next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      if (next === null) return;
      event.preventDefault();
      activate(next, true);
    };
    tab.addEventListener("click", onClick);
    tab.addEventListener("keydown", onKeyDown);
    cleanup.push(() => {
      tab.removeEventListener("click", onClick);
      tab.removeEventListener("keydown", onKeyDown);
    });
  });
}

function enhanceExplorer(cleanup: Array<() => void>, controls: StopControl[]) {
  const root = document.querySelector<HTMLElement>("[data-explorer]");
  if (!root) return;
  const selects = Array.from(
    root.querySelectorAll<HTMLSelectElement>("[data-filter]"),
  );
  const cards = Array.from(
    root.querySelectorAll<HTMLElement>("[data-example-card]"),
  );
  const count = root.querySelector<HTMLElement>("[data-result-count]");
  const empty = root.querySelector<HTMLElement>("[data-explorer-empty]");
  const clearButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-clear-filters]"),
  );

  const update = () => {
    let visible = 0;
    cards.forEach((card) => {
      const matches = selects.every((select) => {
        const key = select.dataset.filter;
        return (
          !select.value || (key ? card.dataset[key] === select.value : true)
        );
      });
      card.hidden = !matches;
      if (matches) {
        visible += 1;
        reveal(card, controls);
      }
    });
    if (count) {
      count.textContent = `${visible} illustrative ${visible === 1 ? "result" : "results"}`;
    }
    if (empty) empty.hidden = visible !== 0;
    const filtered = selects.some((select) => Boolean(select.value));
    clearButtons.forEach((button) => {
      button.disabled = !filtered;
    });
  };

  const clear = () => {
    selects.forEach((select) => {
      select.value = "";
    });
    update();
  };
  selects.forEach((select) => {
    select.addEventListener("change", update);
    cleanup.push(() => select.removeEventListener("change", update));
  });
  clearButtons.forEach((button) => {
    button.addEventListener("click", clear);
    cleanup.push(() => button.removeEventListener("click", clear));
  });
  update();
}

function enhanceReadiness(cleanup: Array<() => void>, controls: StopControl[]) {
  const root = document.querySelector<HTMLElement>("[data-readiness]");
  if (!root) return;
  const inputs = Array.from(
    root.querySelectorAll<HTMLInputElement>("input[type=checkbox]"),
  );
  const count = root.querySelector<HTMLElement>("[data-readiness-count]");
  const progress = root.querySelector<HTMLElement>("[role=progressbar]");
  const bar = root.querySelector<HTMLElement>("[data-readiness-bar]");
  const reset = root.querySelector<HTMLButtonElement>("[data-readiness-reset]");

  const update = () => {
    const complete = inputs.filter((input) => input.checked).length;
    inputs.forEach((input) => {
      const item = input.closest<HTMLElement>("li");
      if (item) item.dataset.complete = String(input.checked);
    });
    if (count)
      count.textContent = `${complete} of ${inputs.length} areas reviewed`;
    progress?.setAttribute("aria-valuenow", String(complete));
    progress?.setAttribute(
      "aria-label",
      `${complete} of ${inputs.length} readiness areas reviewed`,
    );
    if (bar) {
      const scaleX = inputs.length ? complete / inputs.length : 0;
      if (canAnimate()) {
        controls.push(
          animate(
            bar,
            { transform: `scaleX(${scaleX})` },
            { duration: motionDurations.standard },
          ),
        );
      } else {
        bar.style.transform = `scaleX(${scaleX})`;
      }
    }
    if (reset) reset.disabled = complete === 0;
  };

  inputs.forEach((input) => {
    input.addEventListener("change", update);
    cleanup.push(() => input.removeEventListener("change", update));
  });
  const onReset = () => {
    inputs.forEach((input) => {
      input.checked = false;
    });
    update();
  };
  reset?.addEventListener("click", onReset);
  cleanup.push(() => reset?.removeEventListener("click", onReset));
  update();
}

function enhanceFaq(cleanup: Array<() => void>, controls: StopControl[]) {
  document
    .querySelectorAll<HTMLDetailsElement>("[data-faq-item]")
    .forEach((item) => {
      const onToggle = () => {
        const answer = item.querySelector<HTMLElement>("[data-faq-answer]");
        if (item.open && answer) reveal(answer, controls);
      };
      item.addEventListener("toggle", onToggle);
      cleanup.push(() => item.removeEventListener("toggle", onToggle));
    });
}

export function enhanceProductStory() {
  const cleanup: Array<() => void> = [];
  const controls: StopControl[] = [];
  document.documentElement.dataset.productStoryEnhanced = "true";
  document
    .querySelectorAll<HTMLElement>("[data-product-tabs]")
    .forEach((group) => enhanceTabs(group, cleanup, controls));
  enhanceExplorer(cleanup, controls);
  enhanceReadiness(cleanup, controls);
  enhanceFaq(cleanup, controls);

  return () => {
    delete document.documentElement.dataset.productStoryEnhanced;
    cleanup.forEach((remove) => remove());
    controls.forEach((control) => control.stop());
  };
}
