import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom does not implement scrollTo; stub it so step transitions stay quiet.
vi.stubGlobal("scrollTo", vi.fn());

afterEach(() => cleanup());
