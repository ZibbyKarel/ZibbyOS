import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ZibbyLiveTranscript, ZibbyLiveTranscriptTestId } from "./ZibbyLiveTranscript";

describe("ZibbyLiveTranscript", () => {
  it("renders nothing while nothing was heard", () => {
    const { container } = render(<ZibbyLiveTranscript transcript={{ final: "", interim: "" }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows confirmed words in normal ink and the in-progress tail muted", () => {
    render(
      <ZibbyLiveTranscript transcript={{ final: "A ten rebase předej", interim: "agentovi" }} />,
    );
    const final = screen.getByTestId(ZibbyLiveTranscriptTestId.Final);
    const interim = screen.getByTestId(ZibbyLiveTranscriptTestId.Interim);
    expect(final).toHaveTextContent("A ten rebase předej");
    expect(interim).toHaveTextContent("agentovi");
    expect(final.className).not.toBe(interim.className);
  });

  it("renders just the interim tail on its own", () => {
    render(<ZibbyLiveTranscript transcript={{ final: "", interim: "ahoj" }} />);
    expect(screen.queryByTestId(ZibbyLiveTranscriptTestId.Final)).not.toBeInTheDocument();
    expect(screen.getByTestId(ZibbyLiveTranscriptTestId.Interim)).toHaveTextContent("ahoj");
  });
});
