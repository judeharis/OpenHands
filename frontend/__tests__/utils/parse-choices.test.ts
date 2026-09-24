import { describe, expect, it } from "vitest";
import { formatAnswer, parseChoices } from "#/utils/parse-choices";

describe("parseChoices", () => {
  it("reads one question with labelled options", () => {
    const q = parseChoices(JSON.stringify({
      question: "Which stack?",
      options: [{ label: "React + Vite", description: "fast dev server" }, { label: "Plain HTML" }],
    }));
    expect(q).toEqual([{ question: "Which stack?", multiSelect: false, options: [
      { label: "React + Vite", description: "fast dev server" }, { label: "Plain HTML" },
    ] }]);
  });

  it("reads several questions, bare-string options and multiSelect", () => {
    const q = parseChoices(JSON.stringify({ questions: [
      { question: "Tests?", options: ["yes", "no"] },
      { question: "Extras?", multiSelect: true, options: ["lint", "ci", "docs"] },
    ] }));
    expect(q?.map((x) => [x.question, x.multiSelect, x.options.length])).toEqual([["Tests?", false, 2], ["Extras?", true, 3]]);
  });

  it("refuses what it cannot render as a picker", () => {
    expect(parseChoices("not json")).toBeNull();
    expect(parseChoices(JSON.stringify({ question: "Only one?", options: ["a"] }))).toBeNull();
    expect(parseChoices(JSON.stringify({ options: ["a", "b"] }))).toBeNull();
    expect(parseChoices(JSON.stringify({ question: "q", options: ["a", { nope: 1 }] }))).toBeNull();
  });
});

describe("formatAnswer", () => {
  it("answers in the agent's own labels", () => {
    const one = parseChoices(JSON.stringify({ question: "Which?", options: ["A", "B"] }))!;
    expect(formatAnswer(one, [["B"]])).toBe("My choice: B");
    const two = parseChoices(JSON.stringify({ questions: [
      { question: "Tests?", options: ["yes", "no"] },
      { question: "Extras?", multiSelect: true, options: ["lint", "ci"] },
    ] }))!;
    expect(formatAnswer(two, [["yes"], ["lint", "ci"]])).toBe("Tests? → yes\nExtras? → lint; ci");
  });
});

describe("inferChoices", () => {
  it("reads the options gpt-oss-120b wrote in prose (captured 2026-09-23)", async () => {
    const { readFileSync } = await import("node:fs");
    const { inferChoices } = await import("#/utils/parse-choices");
    const text = readFileSync(`${__dirname}/gpt-oss-options.fixture.md`, "utf8");
    const q = inferChoices(text)!;
    expect(q.map((x) => x.options.length)).toEqual([4, 3]);
    expect(q[0].question).toMatch(/^Game type – Which of these/);
    expect(q[0].options[1].label).toBe("Classic “Snake” style canvas game");
    expect(q[1].options[1]).toEqual({ label: "React (using Vite)", description: "modern component‑based approach" });
  });

  it("leaves summaries, single bullets and choices blocks alone", async () => {
    const { inferChoices } = await import("#/utils/parse-choices");
    expect(inferChoices("Done. Files:\n- a.js\n- b.js\n- c.css")).toBeNull();
    expect(inferChoices("Shall I go on?\n- yes")).toBeNull();
    expect(inferChoices("Which?\n```choices\n{}\n```")).toBeNull();
  });
});
