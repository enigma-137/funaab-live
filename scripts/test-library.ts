import assert from "node:assert/strict";
import { isLibraryOpen } from "../src/config/library";
for (const [time, open] of [
  ["2026-10-12T06:59:59Z", false],
  ["2026-10-12T07:00:00Z", true],
  ["2026-10-12T15:59:59Z", true],
  ["2026-10-12T16:00:00Z", false],
  ["2026-10-16T12:00:00Z", true],
  ["2026-10-17T12:00:00Z", false],
  ["2026-10-18T12:00:00Z", false],
  ["2026-10-19T07:00:00Z", true],
] as const)
  assert.equal(isLibraryOpen(Date.parse(time)), open, time);
console.log(
  "Library hours: weekday, weekend, opening and closing boundaries passed.",
);
