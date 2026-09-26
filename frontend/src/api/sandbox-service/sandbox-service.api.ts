// sandbox-service.api.ts
// This file contains API methods for /api/v1/sandboxes endpoints.

import { openHands } from "../open-hands-axios";
import type { V1SandboxInfo, V1SandboxSpecPage } from "./sandbox-service.types";

export class SandboxService {
  /**
   * Pause a V1 sandbox
   * Calls the /api/v1/sandboxes/{id}/pause endpoint
   */
  static async pauseSandbox(sandboxId: string): Promise<{ success: boolean }> {
    const { data } = await openHands.post<{ success: boolean }>(
      `/api/v1/sandboxes/${sandboxId}/pause`,
      {},
    );
    return data;
  }

  /**
   * Resume a V1 sandbox
   * Calls the /api/v1/sandboxes/{id}/resume endpoint
   */
  static async resumeSandbox(sandboxId: string): Promise<{ success: boolean }> {
    const { data } = await openHands.post<{ success: boolean }>(
      `/api/v1/sandboxes/${sandboxId}/resume`,
      {},
    );
    return data;
  }

  /**
   * Delete a V1 sandbox: its container is removed, the conversations in it go
   * MISSING and keep their history on the workspace mount (Reopen restores them).
   * The app declares the route as /{id} but names the handler argument
   * sandbox_id, so FastAPI takes the id from the query string (upstream 1.36).
   */
  static async deleteSandbox(sandboxId: string): Promise<{ success: boolean }> {
    const { data } = await openHands.delete<{ success: boolean }>(
      `/api/v1/sandboxes/${sandboxId}`,
      { params: { sandbox_id: sandboxId } },
    );
    return data;
  }

  /**
   * Search / list available sandbox specs
   * Calls the /api/v1/sandbox-specs/search endpoint
   */
  static async searchSandboxSpecs(): Promise<V1SandboxSpecPage> {
    const { data } = await openHands.get<V1SandboxSpecPage>(
      `/api/v1/sandbox-specs/search`,
    );
    return data;
  }

  /**
   * Batch get V1 sandboxes by their IDs
   * Returns null for any missing sandboxes
   */
  static async batchGetSandboxes(
    ids: string[],
  ): Promise<(V1SandboxInfo | null)[]> {
    if (ids.length === 0) {
      return [];
    }
    if (ids.length > 100) {
      throw new Error("Cannot request more than 100 sandboxes at once");
    }
    const params = new URLSearchParams();
    ids.forEach((id) => params.append("id", id));
    const { data } = await openHands.get<(V1SandboxInfo | null)[]>(
      `/api/v1/sandboxes?${params.toString()}`,
    );
    return data;
  }
}
