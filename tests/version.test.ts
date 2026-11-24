import { describe, expect, it } from "vitest";
import { APP_VERSION } from "../src/version";
import tauriConf from "../src-tauri/tauri.conf.json";

describe("app version", () => {
  it("matches the desktop app config", () => {
    expect(APP_VERSION).toBe(tauriConf.version);
  });
});
