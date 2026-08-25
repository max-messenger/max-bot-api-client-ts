import type { Button, InlineKeyboardAttachmentRequest } from '../core/network/api';

/** `hide` используется только при построении клавиатуры и не отправляется в MAX. */
export type HideableButton<B extends Button = Button> = B & { hide?: boolean };

export interface KeyboardBuildingOptions<B extends HideableButton = HideableButton> {
  /** Количество кнопок в строке, если не задан `wrap`. */
  columns?: number;
  /** При true начинает новую строку перед текущей кнопкой. */
  wrap?: (button: B, index: number, currentRow: B[]) => boolean;
}

const isGrid = <B>(buttons: B[] | B[][]): buttons is B[][] => {
  // Пустой массив обработан выше, поэтому для определения сетки достаточно первого элемента.
  return buttons.length > 0 && Array.isArray(buttons[0]);
};

const removeMetadata = <B extends HideableButton>(button: B): Button => {
  // Клонируем кнопку, потому что её исходное описание может использоваться повторно.
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
    // Сохраняем заданные строки, удаляя только скрытые кнопки и опустевшие строки.
    return buttons
      .map((row) => row.filter((button) => !button.hide).map(removeMetadata))
      .filter((row) => row.length > 0);
  }

  // Раскладка строится только по видимым кнопкам; служебные данные не попадают в запрос.
  const visible = buttons.filter((button) => !button.hide);
  const columns = options.columns ?? 1;
  if (!Number.isInteger(columns) || columns < 1) {
    throw new RangeError('Keyboard columns must be a positive integer');
  }

  let rows: B[][];
  const { wrap } = options;
  if (wrap === undefined) {
    // При фиксированном числе колонок достаточно разбить массив на части.
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
  // Перегрузка сохраняет исходную двумерную форму и добавляет плоский список.
  return {
    type: 'inline_keyboard',
    payload: { buttons: buildKeyboard(buttons, options) },
  };
}

export * as button from './buttons';
