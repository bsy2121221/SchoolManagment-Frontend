import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { differenceInCalendarDays, startOfMonth } from 'date-fns'
import { useMemo, useState } from 'react'
import { StatCard } from '@/components/data/StatCard'
import { toApiDate, today } from '@/lib/dates'
import { FEE_LIMITS, formatMoney, paymentTotals } from '../feeRules'
import { useGetPaymentsQuery } from '../feesApi'
import { PaymentsTable } from './PaymentsTable'

/**
 * The school's payment ledger for a date range: what came in, by the day it was received.
 *
 * The range is required by the endpoint and capped at 366 days, because the ledger is unpaged.
 * An invalid range is caught here and the query skipped, so the server's 400 is never the
 * message someone reads.
 */
export function LedgerTab() {
  const [from, setFrom] = useState<Date | null>(() => startOfMonth(today()))
  const [to, setTo] = useState<Date | null>(() => today())

  const startDate = toApiDate(from)
  const endDate = toApiDate(to)

  const rangeError =
    !from || !to || !startDate || !endDate
      ? 'Choose both dates.'
      : to < from
        ? 'The end date is before the start date.'
        : differenceInCalendarDays(to, from) >= FEE_LIMITS.ledgerDays
          ? `The range cannot be longer than ${FEE_LIMITS.ledgerDays} days.`
          : null

  const { data, isLoading, isFetching, error, refetch } = useGetPaymentsQuery(
    { startDate: startDate ?? '', endDate: endDate ?? '' },
    { skip: rangeError !== null },
  )

  const totals = useMemo(() => paymentTotals(data ?? []), [data])

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <DatePicker
          label="From"
          value={from}
          onChange={setFrom}
          maxDate={today()}
          slotProps={{ textField: { size: 'small' } }}
        />
        <DatePicker
          label="To"
          value={to}
          onChange={setTo}
          maxDate={today()}
          slotProps={{ textField: { size: 'small' } }}
        />
      </Stack>

      {rangeError ? (
        <Alert severity="info">{rangeError}</Alert>
      ) : (
        <>
          {data && data.length > 0 && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <StatCard
                label="Collected"
                value={formatMoney(totals.collected)}
                caption={`${totals.count} payment${totals.count === 1 ? '' : 's'}, refunds excluded`}
              />
              <StatCard
                label="Refunded"
                value={formatMoney(totals.refunded)}
                caption="Received in this range and since refunded"
              />
            </Stack>
          )}
          <PaymentsTable
            rows={data}
            loading={isLoading || isFetching}
            error={error}
            onRetry={() => void refetch()}
            showStudent
            emptyTitle="No payments in this range"
            emptyDescription="Nothing was received between these dates."
          />
        </>
      )}
    </Stack>
  )
}
