import TextField from '@mui/material/TextField'
import type { TextFieldProps } from '@mui/material/TextField'
import { Controller } from 'react-hook-form'
import type { Control, FieldValues, Path } from 'react-hook-form'

interface RHFTextFieldProps<T extends FieldValues>
  extends Omit<TextFieldProps, 'name' | 'value' | 'onChange' | 'error' | 'helperText'> {
  name: Path<T>
  control: Control<T>
  /** Shown under the field while it is valid; replaced by the error when it is not. */
  hint?: string
  /**
   * Coerce to a number on change. The API's numeric fields (`maxStudents`) are `int`,
   * and an <input> always hands back a string -- without this the payload carries
   * `"40"` and model binding, not validation, is what rejects it.
   */
  numeric?: boolean
}

/**
 * A TextField wired to react-hook-form.
 *
 * Uses `Controller` rather than `register`, because `register`'s uncontrolled inputs do
 * not reset when a dialog is reopened for a different row -- a real hazard here, where
 * every module edits through the same dialog component.
 *
 * The error slot is shared between client validation (zod) and server validation
 * (`applyServerErrors` calls `setError` with `type: 'server'`), so a rejection from the
 * API lands under the input that caused it and looks no different from a local one.
 */
export function RHFTextField<T extends FieldValues>({
  name,
  control,
  hint,
  numeric = false,
  ...textFieldProps
}: RHFTextFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          {...field}
          // `null` would make MUI treat the field as uncontrolled and warn.
          value={field.value ?? ''}
          onChange={(event) => {
            if (!numeric) {
              field.onChange(event.target.value)
              return
            }
            const raw = event.target.value
            // An empty box is not 0. Passing '' lets zod report "required" rather than
            // the field silently meaning zero, which for maxStudents would be a
            // capacity of nobody.
            field.onChange(raw === '' ? '' : Number(raw))
          }}
          error={Boolean(fieldState.error)}
          helperText={fieldState.error?.message ?? hint}
          {...textFieldProps}
        />
      )}
    />
  )
}
