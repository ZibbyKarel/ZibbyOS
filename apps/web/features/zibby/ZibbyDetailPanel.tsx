"use client";

import { Button, Container, SheetPresentationContext, Stack } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import type { SheetAnchor } from "../bridge/state/measure";
import { selectionLabel, useSheetHistory } from "../bridge/state/sheetHistory";
import { SheetForSelection } from "../bridge/components/sheets/SheetForSelection";
import type { SheetFrame } from "../bridge/components/sheets/sheetTypes";
import type { BridgeSelection } from "../bridge/widgets/registry";

export enum ZibbyDetailPanelTestId {
  Root = "zibby-detail-panel",
  Expand = "zibby-detail-panel-expand",
}

export interface ZibbyDetailPanelProps {
  selection: BridgeSelection;
  full: boolean;
  onToggleFull: () => void;
  onClose: () => void;
  /** Opens another entity: replaces the selection (the sheet's own back stack leads back). */
  onOpen: (selection: BridgeSelection) => void;
}

/** The `panel` presentation ignores geometry; the sheets just need an anchor value. */
const NO_ANCHOR: SheetAnchor = {
  side: "r",
  left: 0,
  width: 0,
  top: 0,
  height: 0,
  eL: 0,
  eT: 0,
  eH: 0,
};

/**
 * A Bridge detail sheet docked in the chat overlay's side slot (todo #17): the very same sheet
 * the dashboard anchors beside a row, rendered with the DS `panel` presentation, so it fills the
 * slot. Links inside the sheet stay in the slot (with a back button); the toolbar carries the
 * split / full toggle the artifact canvas has, the sheet's own ✕ closes it.
 */
export function ZibbyDetailPanel({
  selection,
  full,
  onToggleFull,
  onClose,
  onOpen,
}: ZibbyDetailPanelProps) {
  const t = useTranslations("zibby.detail");
  const tBridge = useTranslations("bridge.sheet");
  const tCommon = useTranslations("common");
  const history = useSheetHistory(selection, onOpen);
  const prev = history.prev;
  const frame: SheetFrame = {
    nav: {
      ...(prev && {
        onBack: history.back,
        backLabel: selectionLabel(prev),
        backAriaLabel: tBridge("back", { label: selectionLabel(prev) }),
      }),
      copyLabel: tCommon("copyId"),
      copiedLabel: tCommon("copied"),
    },
    expanded: false,
    onExpandedChange: () => {},
  };

  return (
    <Container data-testid={ZibbyDetailPanelTestId.Root} height="100%">
      <Stack direction="col" gap="0">
        <Container padding={["75", "100"]}>
          <Stack align="center" direction="row" justify="end">
            <Button
              aria-label={full ? t("backToChat") : t("full")}
              data-testid={ZibbyDetailPanelTestId.Expand}
              icon={full ? "arrow" : "expand"}
              intent="ghost"
              onClick={onToggleFull}
              size="sm"
              title={full ? t("backToChat") : t("full")}
            />
          </Stack>
        </Container>
        <Container grow minHeight="0" position="relative">
          <SheetPresentationContext value="panel">
            <SheetForSelection
              anchor={NO_ANCHOR}
              frame={frame}
              onClose={onClose}
              onOpen={history.open}
              selection={selection}
            />
          </SheetPresentationContext>
        </Container>
      </Stack>
    </Container>
  );
}
