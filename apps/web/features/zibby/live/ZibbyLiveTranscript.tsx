"use client";

import { Typography } from "@zibby/design-system";
import type { ZibbyVoiceTranscript } from "../voice/useZibbyVoice";

export enum ZibbyLiveTranscriptTestId {
  Final = "zibby-live-transcript-final",
  Interim = "zibby-live-transcript-interim",
}

export interface ZibbyLiveTranscriptProps {
  transcript: ZibbyVoiceTranscript;
}

/** The words heard while talking: confirmed ones in normal ink, the in-progress tail muted. */
export function ZibbyLiveTranscript({ transcript }: ZibbyLiveTranscriptProps) {
  const { final, interim } = transcript;
  if (!final && !interim) return null;
  return (
    <>
      {final && (
        <Typography
          as="span"
          data-testid={ZibbyLiveTranscriptTestId.Final}
          size="xl"
          type="text"
          variant="primary"
        >
          {final}
        </Typography>
      )}
      {final && interim ? " " : null}
      {interim && (
        <Typography
          as="span"
          data-testid={ZibbyLiveTranscriptTestId.Interim}
          size="xl"
          type="text"
          variant="tertiary"
        >
          {interim}
        </Typography>
      )}
    </>
  );
}
