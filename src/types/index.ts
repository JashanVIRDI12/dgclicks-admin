/**
 * Discriminated result returned by every server action.
 *
 * Actions never throw across the network boundary — they resolve to this so the
 * caller gets an exhaustively-checked success/failure branch instead of a
 * rejected promise with a stringified stack.
 */
export type ActionResult<TData = void> =
  | { readonly ok: true; readonly data: TData }
  | {
      readonly ok: false;
      readonly error: string;
      readonly code: string;
      /** Keyed by form field name; feeds React Hook Form's `setError`. */
      readonly fieldErrors?: Record<string, string[]>;
    };

/** Envelope returned by every JSON route handler. */
export type ApiResult<TData = unknown> =
  | { readonly ok: true; readonly data: TData }
  | {
      readonly ok: false;
      readonly error: string;
      readonly code: string;
      readonly fieldErrors?: Record<string, string[]>;
    };

/** Standard shape for paginated list endpoints. */
export type Paginated<TItem> = {
  readonly items: readonly TItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
};
