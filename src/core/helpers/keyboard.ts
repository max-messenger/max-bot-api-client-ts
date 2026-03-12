import { InlineKeyboardAttachmentRequest } from '../network/api';
import type { Button } from '../network/api';

// ─── Button row helpers ────────────────────────────────────────────────────────

type Hideable<B extends Button> = B & { hide?: boolean };
type HideableButton = Hideable<Button>;

interface KeyboardBuildingOptions<B extends HideableButton> {
  /** Custom wrap predicate: return `true` to start a new row before `btn`. */
  wrap?: (btn: B, index: number, currentRow: B[]) => boolean;
  /** Maximum buttons per row when no `wrap` function is given. Defaults to 1. */
  columns?: number;
}

function is2D<B>(arr: B[] | B[][]): arr is B[][] {
  return Array.isArray(arr[0]);
}

/**
 * Converts a flat or already-2D button array into a filtered 2D array.
 *
 * Buttons with `hide: true` are always excluded.
 */
function buildKeyboard<B extends HideableButton>(
  buttons: B[] | B[][],
  options: Required<Pick<KeyboardBuildingOptions<B>, 'columns'>> & Pick<KeyboardBuildingOptions<B>, 'wrap'>,
): B[][] {
  if (!Array.isArray(buttons) || buttons.length === 0) return [];

  if (is2D(buttons)) {
    return buttons.map((row) => row.filter((btn) => !btn.hide));
  }

  const visible = buttons.filter((btn) => !btn.hide);
  const wrapFn = options.wrap
    ?? ((_btn: B, _i: number, row: B[]) => row.length >= options.columns);

  const result: B[][] = [];
  let currentRow: B[] = [];

  visible.forEach((btn, idx) => {
    if (wrapFn(btn, idx, currentRow) && currentRow.length > 0) {
      result.push(currentRow);
      currentRow = [];
    }
    currentRow.push(btn);
  });

  if (currentRow.length > 0) result.push(currentRow);
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Create an inline keyboard from a pre-built 2D button array. */
export function inlineKeyboard(
  buttons: HideableButton[][],
): InlineKeyboardAttachmentRequest;
/** Create an inline keyboard from a flat array, auto-split into rows. */
export function inlineKeyboard(
  buttons: HideableButton[],
  options?: KeyboardBuildingOptions<HideableButton>,
): InlineKeyboardAttachmentRequest;
export function inlineKeyboard(
  buttons: HideableButton[] | HideableButton[][],
  options?: KeyboardBuildingOptions<HideableButton>,
): InlineKeyboardAttachmentRequest {
  const cols = options?.columns ?? (is2D(buttons) ? undefined : buttons.length);
  const grid = buildKeyboard(buttons as HideableButton[], {
    columns: cols ?? buttons.length,
    wrap: options?.wrap,
  });
  return {
    type: 'inline_keyboard',
    payload: { buttons: grid as Button[][] },
  };
}

export * as button from './buttons';
