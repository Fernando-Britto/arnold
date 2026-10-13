/**
 * Unit tests for readJsonBody — the shared guard that turns a malformed JSON
 * request body into a 400 response instead of an unhandled 500.
 *
 * The default Jest setup mocks `next/server`, so `NextResponse.json(...)`
 * returns a lightweight `{ json, status, headers }` double (see tests/setup.ts).
 */

import { readJsonBody } from "./request-body";

const requestWithJson = (json: () => Promise<unknown>) =>
  ({ json }) as unknown as Request;

describe("readJsonBody", () => {
  it("returns ok:true with the parsed body when the JSON is valid", async () => {
    const payload = { nombre: "Gold", precio: 15000 };
    const request = requestWithJson(() => Promise.resolve(payload));

    const parsed = await readJsonBody<typeof payload>(request);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.body).toEqual(payload);
    }
  });

  it("returns ok:false with a 400 VALIDATION_ERROR response on malformed JSON", async () => {
    const request = requestWithJson(() =>
      Promise.reject(
        new SyntaxError('Unexpected token \'o\', "no-es-json" is not valid JSON')
      )
    );

    const parsed = await readJsonBody(request);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.response.status).toBe(400);
      expect(await parsed.response.json()).toEqual({
        code: "VALIDATION_ERROR",
        message: "El cuerpo de la solicitud no es JSON válido",
      });
    }
  });

  it("also returns a 400 when the body is empty JSON input", async () => {
    const request = requestWithJson(() =>
      Promise.reject(new SyntaxError("Unexpected end of JSON input"))
    );

    const parsed = await readJsonBody(request);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.response.status).toBe(400);
    }
  });
});
