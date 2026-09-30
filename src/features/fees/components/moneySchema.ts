import { z } from 'zod'

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/

/**
 * A money amount as the dialogs collect it: **text**, validated as a number in range with at
 * most two decimal places, and converted with `Number()` at submit.
 *
 * Text rather than `RHFTextField numeric`, because numeric mode converts on every keystroke:
 * typing `10.` becomes `10` and the box repaints without the point, so `10.50` cannot be typed
 * at all. That is fine for marks and capacities, which are whole numbers, and wrong for money.
 *
 * The decimal check is not pedantry either. The columns are `DECIMAL(10,2)`, so `10.005` would
 * be rounded by SQL Server on the way in, and the receipt would then show a different figure
 * from the one the cashier typed.
 */
export function moneySchema(min: number, max: number, label = 'Amount') {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .regex(MONEY_PATTERN, 'Enter an amount such as 1200 or 1200.50')
    .refine(
      (value) => Number(value) >= min,
      min > 0 ? `${label} must be more than 0` : `${label} cannot be negative`,
    )
    .refine((value) => Number(value) <= max, `${label} cannot exceed ${max.toLocaleString()}`)
}

/** As `moneySchema`, but an empty box is allowed and means "not set". */
export function optionalMoneySchema(min: number, max: number, label = 'Amount') {
  return z.union([z.literal(''), moneySchema(min, max, label)])
}

/** A number from the API as the text a money box starts with. `1200.5` → `1200.50`. */
export function moneyText(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return ''
  return amount.toFixed(2)
}
