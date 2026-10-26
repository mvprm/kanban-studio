import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// findBy/waitFor default to 1s, which parallel runs with coverage can exceed
configure({ asyncUtilTimeout: 5000 });
