import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { transformVSCodeUrl } from "#/utils/vscode-url-helper";

describe("transformVSCodeUrl", () => {
  const originalWindowLocation = window.location;

  beforeEach(() => {
    // Mock window.location
    Object.defineProperty(window, "location", {
      value: {
        hostname: "example.com",
        protocol: "http:",
      },
      writable: true,
    });
  });

  afterEach(() => {
    // Restore window.location
    Object.defineProperty(window, "location", {
      value: originalWindowLocation,
      writable: true,
    });
  });

  it("should return null if input is null", () => {
    expect(transformVSCodeUrl(null)).toBeNull();
  });

  it("should replace localhost with current hostname when they differ", () => {
    const input = "http://localhost:8080/?tkn=abc123&folder=/workspace";
    const expected = "http://example.com:8080/?tkn=abc123&folder=/workspace";

    expect(transformVSCodeUrl(input)).toBe(expected);
  });

  // jentic: the phone reaches the UI over https on the tailnet.
  it("takes the page's scheme too, so an https page does not frame http", () => {
    Object.defineProperty(window, "location", {
      value: { hostname: "phone.example.ts.net", protocol: "https:" },
      writable: true,
    });
    const input = "http://localhost:40000/sb/37369/?tkn=abc&folder=/workspace";

    expect(transformVSCodeUrl(input)).toBe(
      "https://phone.example.ts.net:40000/sb/37369/?tkn=abc&folder=/workspace",
    );
  });

  it("should not modify URL if hostname is not localhost", () => {
    const input = "http://otherhost:8080/?tkn=abc123&folder=/workspace";

    expect(transformVSCodeUrl(input)).toBe(input);
  });

  it("should not modify URL if current hostname is also localhost", () => {
    // Change the mocked hostname to localhost
    Object.defineProperty(window, "location", {
      value: {
        hostname: "localhost",
        protocol: "http:",
      },
      writable: true,
    });

    const input = "http://localhost:8080/?tkn=abc123&folder=/workspace";

    expect(transformVSCodeUrl(input)).toBe(input);
  });

  it("should handle invalid URLs gracefully", () => {
    const input = "not-a-valid-url";

    expect(transformVSCodeUrl(input)).toBe(input);
  });
});
