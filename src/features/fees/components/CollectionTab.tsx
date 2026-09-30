import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import { useMemo, useState } from 'react'
import { ClientDataGrid } from '@/components/data/ClientDataGrid'
import { StatCard } from '@/components/data/StatCard'
import { today } from '@/lib/dates'
import { formatMoney, formatPeriod, toCents } from '../feeRules'
import { useGetCollectionSummaryQuery } from '../feesApi'
import type { CollectionPeriod } from '../types'

function collectedPercent(row: { billed: number; collected: number }): number | null {
  if (row.billed <= 0) return null
  return Math.min(100, (row.collected / row.billed) * 100)
}

/**
 * Billed, collected and outstanding per billing month.
 *
 * **By billing period, not by payment date.** A March fee paid in May is collected in March here.
 * That is the question "how much of what we charged for March has come in", which is what this
 * procedure answers — it is not a cash-flow report, and the caption says so. The payments ledger
 * is the view by date received.
 */
export function CollectionTab() {
  const currentYear = today().getFullYear()
  const [feeYear, setFeeYear] = useState<number | ''>(currentYear)

  const { data, isLoading, isFetching, error, refetch } = useGetCollectionSummaryQuery(
    feeYear === '' ? {} : { feeYear },
  )

  const totals = useMemo(() => {
    let billed = 0
    let collected = 0
    let outstanding = 0
    for (const row of data ?? []) {
      billed += row.billed
      collected += row.collected
      outstanding += row.outstanding
    }
    return { billed: toCents(billed), collected: toCents(collected), outstanding: toCents(outstanding) }
  }, [data])

  const yearOptions = useMemo(() => {
    const years: number[] = []
    for (let year = currentYear + 1; year >= currentYear - 5; year -= 1) years.push(year)
    return years
  }, [currentYear])

  const columns = useMemo<GridColDef<CollectionPeriod>[]>(
    () => [
      {
        field: 'period',
        headerName: 'Billing period',
        flex: 1,
        minWidth: 140,
        // Sort key rather than the label, so Sep sorts after Aug and not after Apr.
        valueGetter: (_value: unknown, row: CollectionPeriod) => row.feeYear * 100 + row.feeMonth,
        valueFormatter: (_value: unknown, row: CollectionPeriod) =>
          formatPeriod(row.feeMonth, row.feeYear),
      },
      { field: 'feeCount', headerName: 'Fees', type: 'number', width: 90 },
      {
        field: 'billed',
        headerName: 'Billed',
        type: 'number',
        width: 130,
        valueFormatter: (value: number) => formatMoney(value),
      },
      {
        field: 'collected',
        headerName: 'Collected',
        type: 'number',
        width: 130,
        valueFormatter: (value: number) => formatMoney(value),
      },
      {
        field: 'outstanding',
        headerName: 'Outstanding',
        type: 'number',
        width: 130,
        valueFormatter: (value: number) => formatMoney(value),
      },
      {
        field: 'progress',
        headerName: 'Collected %',
        sortable: false,
        flex: 1,
        minWidth: 160,
        renderCell: ({ row }) => {
          const percent = collectedPercent(row)
          if (percent === null) return '—'
          return (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', width: '100%', height: '100%' }}>
              <LinearProgress
                variant="determinate"
                value={percent}
                color={percent >= 100 ? 'success' : 'primary'}
                sx={{ flex: 1, height: 6, borderRadius: 3 }}
              />
              <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'right' }}>
                {percent.toFixed(0)}%
              </Typography>
            </Stack>
          )
        },
      },
    ],
    [],
  )

  const overall = collectedPercent(totals)

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <TextField
          select
          size="small"
          label="Billing year"
          value={feeYear}
          onChange={(event) =>
            setFeeYear(event.target.value === '' ? '' : Number(event.target.value))
          }
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All years</MenuItem>
          {yearOptions.map((year) => (
            <MenuItem key={year} value={year}>
              {year}
            </MenuItem>
          ))}
        </TextField>
        <Typography variant="body2" color="text.secondary">
          Grouped by the month a fee was billed for, not the day it was paid.
        </Typography>
      </Stack>

      {data && data.length > 0 && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <StatCard label="Billed" value={formatMoney(totals.billed)} />
          <StatCard
            label="Collected"
            value={formatMoney(totals.collected)}
            caption={overall === null ? undefined : `${overall.toFixed(1)}% of what was billed`}
          />
          <StatCard label="Outstanding" value={formatMoney(totals.outstanding)} />
        </Stack>
      )}

      <ClientDataGrid
        rows={data}
        loading={isLoading || isFetching}
        error={error}
        onRetry={() => void refetch()}
        columns={columns}
        getRowId={(row) => `${row.feeYear}-${row.feeMonth}`}
        autoHeight
        emptyTitle="Nothing billed"
        emptyDescription={
          feeYear === ''
            ? 'No fees have been billed in this school.'
            : `No fees have been billed for ${feeYear}.`
        }
      />
    </Stack>
  )
}
