import { describe, expect, it } from "vitest";
import {
  MAX_FILES_PER_BOOKING,
  isAllowedFileType,
  validateAttachments,
} from "../src/lib/medical-storage";

const CHILD = "11111111-2222-4333-8444-555555555555";
const OTHER_CHILD = "99999999-8888-4777-8666-555555555555";

function attachment(overrides: Record<string, unknown> = {}) {
  return {
    fileName: "rash.jpg",
    fileType: "image/jpeg",
    storagePath: `${CHILD}/1787000000-abc.jpg`,
    fileSizeBytes: 1024,
    ...overrides,
  };
}

describe("isAllowedFileType", () => {
  it("accepts phone photos, PDFs and Word documents", () => {
    for (const type of [
      "image/jpeg",
      "image/png",
      "image/heic",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]) {
      expect(isAllowedFileType(type)).toBe(true);
    }
  });

  it("rejects everything else", () => {
    for (const type of ["video/mp4", "application/zip", "text/html", ""]) {
      expect(isAllowedFileType(type)).toBe(false);
    }
  });
});

describe("validateAttachments", () => {
  it("treats a missing field as no attachments", () => {
    expect(validateAttachments(undefined, CHILD)).toEqual({ ok: true, attachments: [] });
    expect(validateAttachments(null, CHILD)).toEqual({ ok: true, attachments: [] });
  });

  it("accepts a well-formed attachment", () => {
    const result = validateAttachments([attachment()], CHILD);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].storagePath).toBe(`${CHILD}/1787000000-abc.jpg`);
    }
  });

  it("refuses a path belonging to another child", () => {
    // The upload happens browser → Storage, so this is the check that stops a
    // crafted request attaching someone else's document to this booking.
    const result = validateAttachments(
      [attachment({ storagePath: `${OTHER_CHILD}/1787000000-abc.jpg` })],
      CHILD
    );
    expect(result).toEqual({ ok: false, error: "Attachment does not belong to this child" });
  });

  it("refuses traversal out of the child's folder", () => {
    const result = validateAttachments(
      [attachment({ storagePath: `${CHILD}/../${OTHER_CHILD}/secret.pdf` })],
      CHILD
    );
    expect(result.ok).toBe(false);
  });

  it("refuses an unsupported type", () => {
    const result = validateAttachments([attachment({ fileType: "video/mp4" })], CHILD);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Unsupported file type/);
  });

  it("refuses a file over 10 MB", () => {
    const result = validateAttachments(
      [attachment({ fileSizeBytes: 11 * 1024 * 1024 })],
      CHILD
    );
    expect(result).toEqual({ ok: false, error: "Each file must be 10 MB or smaller" });
  });

  it("refuses more than the per-booking limit", () => {
    const many = Array.from({ length: MAX_FILES_PER_BOOKING + 1 }, (_, i) =>
      attachment({ storagePath: `${CHILD}/file-${i}.jpg` })
    );
    const result = validateAttachments(many, CHILD);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/At most 5 files/);
  });

  it("refuses a malformed entry", () => {
    expect(validateAttachments("not-an-array", CHILD).ok).toBe(false);
    expect(validateAttachments([{ fileName: "x.jpg" }], CHILD).ok).toBe(false);
    expect(validateAttachments([null], CHILD).ok).toBe(false);
  });

  it("truncates an absurdly long filename rather than rejecting it", () => {
    const result = validateAttachments([attachment({ fileName: "a".repeat(500) })], CHILD);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.attachments[0].fileName).toHaveLength(255);
  });
});
