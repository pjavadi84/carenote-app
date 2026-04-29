import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { pushMock, searchParamsRef } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  searchParamsRef: { current: "" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
  usePathname: () => "/residents/abc",
}));

import { NoteFilters, buildFilterUrl } from "../note-filters";

const baseProps = {
  basePath: "/residents/abc",
  initialFrom: "",
  initialTo: "",
  initialShift: "all",
  initialIncident: "all",
};

beforeEach(() => {
  pushMock.mockClear();
  searchParamsRef.current = "";
});

describe("buildFilterUrl", () => {
  it("sets a non-default value as a URL param", () => {
    const url = buildFilterUrl(
      "/residents/abc",
      new URLSearchParams(),
      "shift",
      "morning"
    );
    expect(url).toBe("/residents/abc?shift=morning");
  });

  it("removes the param when value is 'all'", () => {
    const url = buildFilterUrl(
      "/residents/abc",
      new URLSearchParams("shift=morning"),
      "shift",
      "all"
    );
    expect(url).toBe("/residents/abc");
  });

  it("removes the param when value is empty", () => {
    const url = buildFilterUrl(
      "/residents/abc",
      new URLSearchParams("from=2026-04-01"),
      "from",
      ""
    );
    expect(url).toBe("/residents/abc");
  });

  it("preserves other existing params when applying a new one", () => {
    const url = buildFilterUrl(
      "/residents/abc",
      new URLSearchParams("shift=morning"),
      "incident",
      "true"
    );
    const qs = new URLSearchParams(url.split("?")[1]);
    expect(qs.get("shift")).toBe("morning");
    expect(qs.get("incident")).toBe("true");
  });

  it("drops the count param when any filter changes", () => {
    const url = buildFilterUrl(
      "/residents/abc",
      new URLSearchParams("count=150"),
      "shift",
      "night"
    );
    expect(url).toBe("/residents/abc?shift=night");
  });

  it("drops the count param even when applying an 'all' (clearing) value", () => {
    const url = buildFilterUrl(
      "/residents/abc",
      new URLSearchParams("shift=morning&count=200"),
      "shift",
      "all"
    );
    expect(url).toBe("/residents/abc");
  });

  it("returns the bare base path when no params remain", () => {
    const url = buildFilterUrl(
      "/residents/abc",
      new URLSearchParams("count=100"),
      "shift",
      "all"
    );
    expect(url).toBe("/residents/abc");
  });
});

describe("NoteFilters component", () => {
  it("pushes a from-date param to the URL on blur", () => {
    render(<NoteFilters {...baseProps} />);

    const fromInput = screen.getByLabelText("From") as HTMLInputElement;
    fireEvent.change(fromInput, { target: { value: "2026-04-01" } });
    fireEvent.blur(fromInput);

    expect(pushMock).toHaveBeenCalledWith("/residents/abc?from=2026-04-01");
  });

  it("clears the from-date param when the input is emptied and blurred", () => {
    searchParamsRef.current = "from=2026-04-01";
    render(<NoteFilters {...baseProps} initialFrom="2026-04-01" />);

    const fromInput = screen.getByLabelText("From") as HTMLInputElement;
    fireEvent.change(fromInput, { target: { value: "" } });
    fireEvent.blur(fromInput);

    expect(pushMock).toHaveBeenCalledWith("/residents/abc");
  });

  it("pushes a to-date param with the inclusive end of day implicit (page handles +T23:59:59Z)", () => {
    render(<NoteFilters {...baseProps} />);

    const toInput = screen.getByLabelText("To") as HTMLInputElement;
    fireEvent.change(toInput, { target: { value: "2026-04-15" } });
    fireEvent.blur(toInput);

    expect(pushMock).toHaveBeenCalledWith("/residents/abc?to=2026-04-15");
  });

  it("preserves existing filter params when changing a date filter", () => {
    searchParamsRef.current = "shift=morning";
    render(<NoteFilters {...baseProps} initialShift="morning" />);

    const fromInput = screen.getByLabelText("From") as HTMLInputElement;
    fireEvent.change(fromInput, { target: { value: "2026-04-01" } });
    fireEvent.blur(fromInput);

    const pushed = pushMock.mock.calls[0][0] as string;
    const qs = new URLSearchParams(pushed.split("?")[1]);
    expect(qs.get("shift")).toBe("morning");
    expect(qs.get("from")).toBe("2026-04-01");
  });

  it("drops an existing count param when a date filter changes", () => {
    searchParamsRef.current = "count=200";
    render(<NoteFilters {...baseProps} />);

    const fromInput = screen.getByLabelText("From") as HTMLInputElement;
    fireEvent.change(fromInput, { target: { value: "2026-04-01" } });
    fireEvent.blur(fromInput);

    expect(pushMock).toHaveBeenCalledWith("/residents/abc?from=2026-04-01");
  });

  it("clears all filters when 'Clear filters' is clicked", async () => {
    searchParamsRef.current = "shift=morning&incident=true&count=200";
    const user = userEvent.setup();
    render(
      <NoteFilters
        {...baseProps}
        initialShift="morning"
        initialIncident="true"
      />
    );

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(pushMock).toHaveBeenCalledWith("/residents/abc");
  });

  it("renders the filter labels", () => {
    render(<NoteFilters {...baseProps} />);
    expect(screen.getByText("Shift")).toBeInTheDocument();
    expect(screen.getByText("Show")).toBeInTheDocument();
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("To")).toBeInTheDocument();
  });
});
