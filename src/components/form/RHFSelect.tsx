import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import type { TextFieldProps } from '@mui/material/TextField'
import { Controller } from 'react-hook-form'
import type { Control, FieldValues, Path } from 'react-hook-form'

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

interface RHFSelectProps<T extends FieldValues>
  extends Omit<TextFieldProps, 'name' | 'value' | 'onChange' | 'error' | 'helperText' | 'select'> {
  name: Path<T>
  control: Control<T>
  options: readonly SelectOption[]
  hint?: string
  /**
   * Adds a blank first entry that submits `null`. For the optional foreign keys the API
   * models as `int?` -- a class teacher, a parent's student -- where "not chosen" has to
   * be expressible and is different from the first name in the list.
   */
  allowEmpty?: boolean
  emptyLabel?: string
  /** Disables the control and shows `hint` while the option list is being fetched. */
  loadingOptions?: boolean
}

/**
 * A `select` TextField wired to react-hook-form.
 *
 * `allowEmpty` matters more than it looks. MUI represents "nothing selected" as `''`,
 * while the API wants `null` for an unset `int?` -- sending `''` gets a model-binding
 * failure rather than a clean "no class teacher". The conversion happens here so no
 * screen has to remember it.
 */
export function RHFSelect<T extends FieldValues>({
  name,
  control,
  options,
  hint,
  allowEmpty = false,
  emptyLabel = 'None',
  loadingOptions = false,
  disabled,
  ...textFieldProps
}: RHFSelectProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          {...field}
          select
          value={field.value ?? ''}
          onChange={(event) => {
            const raw = event.target.value
            field.onChange(raw === '' ? null : raw)
          }}
          disabled={disabled ?? loadingOptions}
          error={Boolean(fieldState.error)}
          helperText={fieldState.error?.message ?? (loadingOptions ? 'Loading…' : hint)}
          {...textFieldProps}
        >
          {allowEmpty && (
            <MenuItem value="">
              <em>{emptyLabel}</em>
            </MenuItem>
          )}
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      )}
    />
  )
}
