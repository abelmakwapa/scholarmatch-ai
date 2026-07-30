"use client";

import { ArrowRight, Check } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";

import { useCases } from "./data";

export function UseCaseTabs() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [interacted, setInteracted] = useState(false);
  const selected = useCases[selectedIndex];

  const selectAndFocus = (index: number) => {
    setInteracted(true);
    setSelectedIndex(index);
    tabRefs.current[index]?.focus();
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectAndFocus((index + 1) % useCases.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectAndFocus((index - 1 + useCases.length) % useCases.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectAndFocus(0);
    } else if (event.key === "End") {
      event.preventDefault();
      selectAndFocus(useCases.length - 1);
    }
  };

  return (
    <div className="use-case-tabs">
      <div
        aria-label="Student use cases"
        className="use-case-tabs__list"
        role="tablist"
      >
        {useCases.map((useCase, index) => (
          <button
            aria-controls={`panel-${useCase.id}`}
            aria-selected={selectedIndex === index}
            id={`tab-${useCase.id}`}
            key={useCase.id}
            onClick={() => {
              setInteracted(true);
              setSelectedIndex(index);
            }}
            onKeyDown={(event) => handleKeyDown(event, index)}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            role="tab"
            tabIndex={selectedIndex === index ? 0 : -1}
            type="button"
          >
            {useCase.label}
          </button>
        ))}
      </div>

      <div className="use-case-tabs__viewport">
        <div
          aria-labelledby={`tab-${selected.id}`}
          className="use-case-panel"
          data-animate={interacted || undefined}
          id={`panel-${selected.id}`}
          key={selected.id}
          role="tabpanel"
        >
          <div className="use-case-panel__copy">
            <span className="use-case-panel__icon" aria-hidden="true">
              <selected.icon size={24} strokeWidth={1.8} />
            </span>
            <p className="eyebrow">{selected.signal}</p>
            <h3>{selected.title}</h3>
            <p>{selected.description}</p>
            <a href="#how-it-works">
              See how matching works <ArrowRight aria-hidden="true" size={17} />
            </a>
          </div>

          <div
            aria-label={`${selected.label} profile signals`}
            className="use-case-panel__visual"
          >
            <span className="use-case-panel__visual-label">
              Profile signals
            </span>
            {selected.facts.map((fact, index) => (
              <div className="use-case-panel__fact" key={fact}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{fact}</strong>
                <Check aria-hidden="true" size={16} />
              </div>
            ))}
            <div className="use-case-panel__match">
              <span>Ready to compare</span>
              <strong>{selected.signal}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
