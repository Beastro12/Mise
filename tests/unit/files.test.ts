import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { docxToText, pdfToText, detectFileKind } from "@/lib/import/files";
import { splitRecipesFromText } from "@/lib/import/text-heuristic";

describe("file text extraction (no-AI path)", () => {
  it("detects file kinds", () => {
    expect(detectFileKind("a.PDF", "")).toBe("pdf");
    expect(detectFileKind("a.docx", "")).toBe("docx");
    expect(detectFileKind("a.md", "")).toBe("text");
    expect(detectFileKind("a.jpg", "image/jpeg")).toBe("image");
    expect(detectFileKind("a.xls", "application/vnd.ms-excel")).toBe("unsupported");
  });

  it("extracts text from .docx and splits recipes", async () => {
    const text = await docxToText(fs.readFileSync("tests/fixtures/two-recipes.docx"));
    const rs = splitRecipesFromText(text);
    expect(rs.map((r) => r.title)).toEqual(["Pinaattiletut", "Kaalilaatikko"]);
  });

  it("extracts text from .pdf and splits recipes", async () => {
    const text = await pdfToText(fs.readFileSync("tests/fixtures/two-recipes.pdf"));
    expect(text).toContain("Pinaattiletut");
    const rs = splitRecipesFromText(text);
    expect(rs.map((r) => r.title)).toEqual(["Pinaattiletut", "Kaalilaatikko"]);
    expect(rs[1].ingredientLines).toContain("400 g jauhelihaa");
  });
});
