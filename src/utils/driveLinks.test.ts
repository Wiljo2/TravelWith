import { describe, it, expect } from "vitest";
import { driveFileUrl, parseDriveFileId } from "./driveLinks";

const ID = "1AbC_dEf-123456789xyz";

describe("Drive links", () => {
  it("reads the file id from share links and bare ids", () => {
    expect(parseDriveFileId(`https://drive.google.com/file/d/${ID}/view?usp=sharing`)).toBe(ID);
    expect(parseDriveFileId(`https://drive.google.com/file/u/1/d/${ID}/view`)).toBe(ID);
    expect(parseDriveFileId(`https://drive.google.com/open?id=${ID}`)).toBe(ID);
    expect(parseDriveFileId(`https://docs.google.com/document/d/${ID}/edit`)).toBe(ID);
    expect(parseDriveFileId(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=0`)).toBe(ID);
    expect(parseDriveFileId(`  ${ID} `)).toBe(ID);
  });

  it("rejects other hosts, folders and junk", () => {
    expect(parseDriveFileId(`https://evil.example/file/d/${ID}/view`)).toBeUndefined();
    expect(parseDriveFileId(`https://drive.google.com/drive/folders/${ID}`)).toBeUndefined();
    expect(parseDriveFileId("short")).toBeUndefined();
    expect(parseDriveFileId("javascript:alert(1)")).toBeUndefined();
  });

  it("builds the viewer link", () => {
    expect(driveFileUrl(ID)).toBe(`https://drive.google.com/file/d/${ID}/view`);
  });
});
