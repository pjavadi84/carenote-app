import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NoteInputForm } from "../note-input-form";

// Get the mocked supabase client
const mockInsert = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-cg-1" } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
  }),
}));

describe("NoteInputForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form with all fields", () => {
    render(
      <NoteInputForm residentId="resident-1" organizationId="org-1" />
    );

    expect(screen.getByPlaceholderText(/describe what you observed/i)).toBeInTheDocument();
    expect(screen.getByText("Save Note")).toBeInTheDocument();
  });

  it("shows character counter", () => {
    render(
      <NoteInputForm residentId="resident-1" organizationId="org-1" />
    );

    expect(screen.getByText("0/2000")).toBeInTheDocument();
  });

  it("disables submit button when input is empty", () => {
    render(
      <NoteInputForm residentId="resident-1" organizationId="org-1" />
    );

    const submitBtn = screen.getByText("Save Note");
    expect(submitBtn).toBeDisabled();
  });

  it("enables submit button when text is entered", async () => {
    const user = userEvent.setup();
    render(
      <NoteInputForm residentId="resident-1" organizationId="org-1" />
    );

    const textarea = screen.getByPlaceholderText(/describe what you observed/i);
    await user.type(textarea, "Dorothy had a good day");

    const submitBtn = screen.getByText("Save Note");
    expect(submitBtn).not.toBeDisabled();
  });

  it("updates character counter as user types", async () => {
    const user = userEvent.setup();
    render(
      <NoteInputForm residentId="resident-1" organizationId="org-1" />
    );

    const textarea = screen.getByPlaceholderText(/describe what you observed/i);
    await user.type(textarea, "Hello");

    expect(screen.getByText("5/2000")).toBeInTheDocument();
  });

  it("auto-selects shift based on time of day", () => {
    render(
      <NoteInputForm residentId="resident-1" organizationId="org-1" />
    );

    const hour = new Date().getHours();
    let expectedLabel: string;
    if (hour < 12) expectedLabel = "Morning";
    else if (hour < 18) expectedLabel = "Afternoon";
    else expectedLabel = "Night";

    // The shift label is rendered inside the Select trigger's SelectValue.
    // There is one SelectValue for note type and one for shift — the shift
    // value is the second one.
    const selectValues = document.querySelectorAll('[data-slot="select-value"]');
    const shiftValue = selectValues[1];
    expect(shiftValue).toBeTruthy();
    expect(shiftValue?.textContent).toBe(expectedLabel);
  });
});
