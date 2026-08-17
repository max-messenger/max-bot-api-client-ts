import type { Button, InlineKeyboardAttachmentRequest } from '../core/network/api';

/** `hide` is local builder metadata and is never sent to MAX. */
export type HideableButton<B extends Button = Button> = B & { hide?: boolean };

export interface KeyboardBuildingOptions<B extends HideableButton = HideableButton> {
  /** Number of buttons per row when no custom wrap function is provided. */
  columns?: number;
  /** Starts a new row before the current button when it returns true. */
  wrap?: (button: B, index: number, currentRow: B[]) => boolean;
}

const isGrid = <B>(buttons: B[] | B[][]): buttons is B[][] => {
  // Empty input is handled before this guard, so inspecting the first element
  // is sufficient and avoids flattening a user-provided layout.
  return buttons.length > 0 && Array.isArray(buttons[0]);
};

const removeMetadata = <B extends HideableButton>(button: B): Button => {
  // Clone before deletion: callers may reuse their button definitions later.
  const result = { ...button };
  delete result.hide;
  return result;
};

const buildKeyboard = <B extends HideableButton>(
  buttons: B[] | B[][],
  options: KeyboardBuildingOptions<B>,
): Button[][] => {
  if (buttons.length === 0) return [];

  if (isGrid(buttons)) {
    // Preserve explicit row boundaries, removing only hidden buttons and rows
    // that became empty as a result.
    return buttons
      .map((row) => row.filter((button) => !button.hide).map(removeMetadata))
      .filter((row) => row.length > 0);
  }

  // Work on visible controls only; layout metadata never reaches the wire model.
  const visible = buttons.filter((button) => !button.hide);
  const columns = options.columns ?? 1;
  if (!Number.isInteger(columns) || columns < 1) {
    throw new RangeError('Keyboard columns must be a positive integer');
  }

  let rows: B[][];
  const { wrap } = options;
  if (wrap === undefined) {
    // Fixed columns are a pure slicing operation, which keeps layout independent
    // from the iteration state used by custom policies.
    const rowCount = Math.ceil(visible.length / columns);
    rows = Array.from({ length: rowCount }, (_, rowIndex) => {
      const start = rowIndex * columns;
      return visible.slice(start, start + columns);
    });
  } else {
    rows = visible.reduce<B[][]>((layout, button, index) => {
      const current = layout[layout.length - 1] ?? [];
      if (current.length === 0 || !wrap(button, index, current)) {
        if (current.length === 0) layout.push(current);
        current.push(button);
      } else {
        layout.push([button]);
      }
      return layout;
    }, []);
  }

  return rows.map((current) => current.map(removeMetadata));
};

export function inlineKeyboard(
  buttons: HideableButton[][],
): InlineKeyboardAttachmentRequest;
export function inlineKeyboard(
  buttons: HideableButton[],
  options?: KeyboardBuildingOptions,
): InlineKeyboardAttachmentRequest;
export function inlineKeyboard(
  buttons: HideableButton[] | HideableButton[][],
  options: KeyboardBuildingOptions = {},
): InlineKeyboardAttachmentRequest {
  // Overloads retain the original two-dimensional API while adding a convenient
  // flat builder without changing the wire-format returned to MAX.
  return {
    type: 'inline_keyboard',
    payload: { buttons: buildKeyboard(buttons, options) },
  };
}

export * as button from './buttons';
