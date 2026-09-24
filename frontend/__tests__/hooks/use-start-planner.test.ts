import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useStartPlanner } from "#/hooks/use-start-planner";
import { useConversationStore } from "#/stores/conversation-store";
import { getConversationState } from "#/utils/conversation-local-storage";

const createConversation = vi.fn();
const uploadFiles = vi.fn();
const rename = vi.fn();
vi.mock("#/hooks/mutation/use-create-conversation", () => ({
  useCreateConversation: () => ({ mutate: createConversation }),
}));
vi.mock("#/hooks/mutation/use-unified-upload-files", () => ({
  useUnifiedUploadFiles: () => ({ mutateAsync: uploadFiles }),
}));
vi.mock("#/hooks/mutation/use-update-conversation", () => ({
  useUpdateConversation: () => ({ mutate: rename }),
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: () => "NEW FILES ADDED" }),
}));

const pending = (over = {}) => ({
  taskId: "t1",
  conversationId: "code1",
  text: "ship a feature\nwith tests",
  images: [],
  files: [],
  mode: "plan" as const,
  ...over,
});

describe("useStartPlanner (a home-screen Plan inside one conversation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useConversationStore.setState({ conversationMode: "code", subConversationTaskId: null });
    createConversation.mockImplementation((_v, { onSuccess }) => onSuccess({ v1_task_id: "sub1" }));
  });

  it("starts the planner as a sub-conversation with the message, in plan mode", async () => {
    const { result } = renderHook(() => useStartPlanner());
    await act(async () => {
      await result.current("code1", pending());
    });

    expect(createConversation.mock.calls[0][0]).toEqual({
      parentConversationId: "code1",
      agentType: "plan",
      query: "ship a feature\nwith tests",
      imageUrls: undefined,
    });
    expect(useConversationStore.getState().conversationMode).toBe("plan");
    expect(useConversationStore.getState().subConversationTaskId).toBe("sub1");
    expect(getConversationState("code1")).toMatchObject({
      conversationMode: "plan",
      subConversationTaskId: "sub1",
    });
    // named after the message, not after the hidden build step that will come first
    expect(rename).toHaveBeenCalledWith({ conversationId: "code1", newTitle: "ship a feature" });
  });

  it("uploads files into the shared sandbox and names them in the planner's message", async () => {
    uploadFiles.mockResolvedValue({ uploaded_files: ["/workspace/spec.pdf"], skipped_files: [] });
    const file = new File(["%PDF"], "spec.pdf", { type: "application/pdf" });
    const { result } = renderHook(() => useStartPlanner());
    await act(async () => {
      await result.current("code1", pending({ files: [file] }));
    });

    expect(uploadFiles).toHaveBeenCalledWith({ conversationId: "code1", files: [file] });
    expect(createConversation.mock.calls[0][0].query).toBe(
      "ship a feature\nwith tests\n\nNEW FILES ADDED: /workspace/spec.pdf",
    );
  });

  it("starts an empty planner for an empty Plan", async () => {
    const { result } = renderHook(() => useStartPlanner());
    await act(async () => {
      await result.current("code1", pending({ text: "" }));
    });
    expect(createConversation.mock.calls[0][0].query).toBeUndefined();
    expect(rename).not.toHaveBeenCalled();
  });
});
