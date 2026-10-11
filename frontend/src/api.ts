import type { components } from "./api.generated";

export type ProjectInput = components["schemas"]["ProjectInput"];
export type Prediction = components["schemas"]["Prediction"];
export type ModelInfo = components["schemas"]["ModelInfo"];
export type Options = components["schemas"]["Options"];
export type CpiSelection = components["schemas"]["CpiSelection"];

export class FieldError extends Error {
  constructor(public fields: string[]) {
    super("Bitte die markierten Eingaben prüfen. Eingaben bleiben erhalten; danach erneut prüfen.");
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (response.status === 422 && Array.isArray(body?.detail)) {
      throw new FieldError(
        body.detail.flatMap((item: { loc?: unknown[] }) =>
          Array.isArray(item.loc) && typeof item.loc[1] === "string" ? [item.loc[1]] : [],
        ),
      );
    }
    throw new Error(
      typeof body?.detail === "string"
        ? body.detail
        : `Die Anfrage konnte nicht verarbeitet werden (HTTP ${response.status}).`,
    );
  }
  return response.json();
}
