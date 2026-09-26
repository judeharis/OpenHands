import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeComposer } from "#/components/features/home/home-composer";
import { usePendingFirstMessageStore } from "#/stores/pending-first-message-store";

const createConversation = vi.fn();

vi.mock("react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("#/hooks/mutation/use-create-conversation", () => ({
  useCreateConversation: () => ({
    mutate: createConversation,
    isPending: false,
    isSuccess: false,
  }),
}));
vi.mock("#/hooks/use-is-creating-conversation", () => ({
  useIsCreatingConversation: () => false,
}));
vi.mock("#/utils/wav-recorder", () => ({
  startWavRecording: vi.fn(async () => ({
    stop: async () => ({ wav: new Blob(["RIFF"]), seconds: 2 }),
    cancel: () => {},
  })),
}));
vi.mock("#/api/voice-service.api", () => ({
  transcribeSpeech: vi.fn(async () => "and add tests"),
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (k: string) => k }),
}));

beforeEach(() => {
  createConversation.mockReset();
  usePendingFirstMessageStore.setState({ pending: null });
});

describe("starting a conversation from the home screen (jentic)", () => {
  // The agent type can only be set when the conversation is created, so without this
  // control the only way into plan mode was jentic-cli.
  it("starts in code mode by default", async () => {
    render(<HomeComposer />);
    await userEvent.type(screen.getByTestId("home-composer"), "build a thing");
    await userEvent.click(screen.getByTestId("submit-button"));

    await waitFor(() => expect(createConversation).toHaveBeenCalled());
    expect(createConversation.mock.calls[0][0]).toMatchObject({
      query: "build a thing",
      agentType: "default",
    });
  });

  // A Plan is one conversation: a code conversation, with the planner started inside it
  // by the chat (use-start-planner), so Build never opens a second one.
  it("starts a plan as a code conversation whose first message waits for the planner", async () => {
    createConversation.mockImplementation((_vars, { onSuccess }) =>
      onSuccess({ conversation_id: "task-t2", v1_task_id: "t2" }),
    );
    render(<HomeComposer />);
    await userEvent.click(screen.getByTestId("home-mode-plan"));
    await userEvent.type(screen.getByTestId("home-composer"), "ship a feature");
    await userEvent.click(screen.getByTestId("submit-button"));

    await waitFor(() => expect(createConversation).toHaveBeenCalled());
    expect(createConversation.mock.calls[0][0]).toEqual({
      agentType: "default",
    });
    expect(usePendingFirstMessageStore.getState().pending).toMatchObject({
      taskId: "t2",
      text: "ship a feature",
      mode: "plan",
      images: [],
      files: [],
    });
  });

  it("carries the choice into an empty conversation too", async () => {
    createConversation.mockImplementation((_vars, { onSuccess }) =>
      onSuccess({ conversation_id: "task-t3", v1_task_id: "t3" }),
    );
    render(<HomeComposer />);
    await userEvent.click(screen.getByTestId("home-mode-plan"));
    await userEvent.click(screen.getByTestId("launch-new-conversation-button"));

    await waitFor(() => expect(createConversation).toHaveBeenCalled());
    expect(createConversation.mock.calls[0][0]).toEqual({
      agentType: "default",
    });
    expect(usePendingFirstMessageStore.getState().pending).toMatchObject({
      text: "",
      mode: "plan",
    });
  });

  it("says which mode is selected, for a screen reader too", async () => {
    render(<HomeComposer />);
    expect(screen.getByTestId("home-mode-default")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("home-mode-plan")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await userEvent.click(screen.getByTestId("home-mode-plan"));
    expect(screen.getByTestId("home-mode-plan")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("puts dictated text after what is typed", async () => {
    render(<HomeComposer />);
    const box = screen.getByTestId("home-composer");
    await userEvent.type(box, "build a thing");
    const mic = screen.getByTestId("mic-button");

    await userEvent.click(mic);
    await waitFor(() => expect(mic).toHaveAttribute("data-state", "recording"));
    await userEvent.click(mic);

    await waitFor(() => expect(box).toHaveValue("build a thing and add tests"));
  });

  describe("attachments", () => {
    const image = () => new File(["png"], "mouse.png", { type: "image/png" });
    const file = () => new File(["a,b"], "data.csv", { type: "text/csv" });
    // user-event reads accept="*/*" as matching no type at all and drops every file.
    // Attachments show once they are read into memory (snapshotFile), a tick later.
    const upload = async (files: File | File[]) => {
      await userEvent
        .setup({ applyAccept: false })
        .upload(screen.getByTestId("upload-image-input"), files);
      await screen.findByTestId("home-attachments");
    };

    it("sends an attached image in the first message", async () => {
      render(<HomeComposer />);
      await upload(image());
      expect(screen.getByTestId("home-attachments")).toBeInTheDocument();
      await userEvent.type(screen.getByTestId("home-composer"), "use this");
      await userEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => expect(createConversation).toHaveBeenCalled());
      const vars = createConversation.mock.calls[0][0];
      expect(vars.query).toBe("use this");
      expect(vars.imageUrls).toHaveLength(1);
      expect(vars.imageUrls[0]).toMatch(/^data:image\/png;base64,/);
    });

    it("can send an image with no text", async () => {
      render(<HomeComposer />);
      expect(screen.getByTestId("submit-button")).toBeDisabled();
      await upload(image());
      await userEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => expect(createConversation).toHaveBeenCalled());
      expect(createConversation.mock.calls[0][0].imageUrls).toHaveLength(1);
    });

    // A file needs the sandbox, which does not exist yet: the conversation starts empty
    // and the whole message waits for its chat.
    it("holds a message with a file until the conversation has started", async () => {
      createConversation.mockImplementation((_vars, { onSuccess }) =>
        onSuccess({ conversation_id: "task-t1", v1_task_id: "t1" }),
      );
      render(<HomeComposer />);
      await upload([file(), image()]);
      await userEvent.type(screen.getByTestId("home-composer"), "read it");
      await userEvent.click(screen.getByTestId("submit-button"));

      await waitFor(() => expect(createConversation).toHaveBeenCalled());
      expect(createConversation.mock.calls[0][0].query).toBeUndefined();
      const { pending } = usePendingFirstMessageStore.getState();
      expect(pending).toMatchObject({ taskId: "t1", text: "read it" });
      expect(pending?.files.map((f) => f.name)).toEqual(["data.csv"]);
      expect(pending?.images.map((f) => f.name)).toEqual(["mouse.png"]);
    });

    it("leaves attachments out of an empty conversation", async () => {
      render(<HomeComposer />);
      await upload(image());
      await userEvent.click(
        screen.getByTestId("launch-new-conversation-button"),
      );

      await waitFor(() => expect(createConversation).toHaveBeenCalled());
      expect(createConversation.mock.calls[0][0].imageUrls).toBeUndefined();
    });
  });
});
