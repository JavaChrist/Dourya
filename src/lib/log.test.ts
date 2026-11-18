import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { errorCategory, errorCode, logEvent } = await import("./log");

/** Shape of a google-gax / @grpc/grpc-js error: numeric code, details, message. */
function grpcError(code: number, details: string): Error {
  return Object.assign(new Error(`${code} ${details}`), { code, details });
}

afterEach(() => vi.restoreAllMocks());

describe("errorCode", () => {
  it("keeps Firebase string codes", () => {
    expect(errorCode(Object.assign(new Error("x"), { code: "auth/session-cookie-expired" }))).toBe("auth/session-cookie-expired");
  });

  it("names numeric gRPC codes", () => {
    expect(errorCode(grpcError(16, "x"))).toBe("grpc_16_UNAUTHENTICATED");
    expect(errorCode(grpcError(7, "x"))).toBe("grpc_7_PERMISSION_DENIED");
    expect(errorCode(grpcError(5, "x"))).toBe("grpc_5_NOT_FOUND");
    expect(errorCode(grpcError(14, "x"))).toBe("grpc_14_UNAVAILABLE");
    expect(errorCode(grpcError(13, "x"))).toBe("grpc_13_INTERNAL");
    expect(errorCode(grpcError(42, "x"))).toBe("grpc_42_UNKNOWN_CODE");
  });

  it("falls back to the error name, then unknown", () => {
    expect(errorCode(new TypeError("x"))).toBe("TypeError");
    expect(errorCode({ code: 1.5 })).toBe("unknown");
    expect(errorCode(null)).toBe("unknown");
  });
});

describe("errorCategory", () => {
  it("sorts Google errors into known categories", () => {
    expect(errorCategory(grpcError(14, "Getting metadata from plugin failed with error: invalid_grant: Invalid JWT Signature."))).toBe("auth_invalid_grant");
    expect(errorCategory(grpcError(16, "Request had invalid authentication credentials."))).toBe("auth_credentials");
    expect(errorCategory(grpcError(14, "Getting metadata from plugin failed with error: error:1E08010C:DECODER routines::unsupported"))).toBe("auth_key_format");
    expect(errorCategory(new Error("error:0909006C:PEM routines:get_name:no start line"))).toBe("auth_key_format");
    expect(errorCategory(grpcError(14, "Getting metadata from plugin failed with error: request to oauth2 failed"))).toBe("auth_credentials");
    expect(errorCategory(grpcError(7, "Missing or insufficient permissions."))).toBe("permission_denied");
    expect(errorCategory(grpcError(7, "Cloud Firestore API has not been used in project 123 before or it is disabled."))).toBe("api_disabled");
    expect(errorCategory(grpcError(5, "The database (default) does not exist for project x."))).toBe("database_not_found");
    expect(errorCategory(grpcError(14, "No connection established"))).toBe("unavailable");
    expect(errorCategory(grpcError(4, "Deadline exceeded"))).toBe("timeout");
    expect(errorCategory(grpcError(13, "Internal"))).toBe("other");
    expect(errorCategory(new Error("x"))).toBe("other");
    expect(errorCategory("x")).toBe("other");
  });

  it("never lets the raw Google message reach the log line", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const details = "Permission denied for firebase-adminsdk-abc@dourya.iam.gserviceaccount.com on projects/123456789 token ya29.SECRET";
    const error = grpcError(7, details);
    logEvent("email_webhook_failed", { event: "email.delivered", error: errorCode(error), category: errorCategory(error) });
    const line = warn.mock.calls.flat().join(" ");
    expect(line).toBe('[dourya] email_webhook_failed {"event":"email.delivered","error":"grpc_7_PERMISSION_DENIED","category":"permission_denied"}');
    for (const leak of ["@", "gserviceaccount", "123456789", "ya29", "SECRET", "Permission denied"]) expect(line).not.toContain(leak);
  });
});
