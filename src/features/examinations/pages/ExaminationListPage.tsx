import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import GradingIcon from '@mui/icons-material/Grading'
import PendingActionsIcon from '@mui/icons-material/PendingActions'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch } from '@/app/hooks'
import { ClientDataGrid } from '@/components/data/ClientDataGrid'
import { StatCard } from '@/components/data/StatCard'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { PageHeader } from '@/components/layout/PageHeader'
import { Can } from '@/features/auth/Can'
import { useCan, useModulePermissions } from '@/features/auth/permissions'
import { classLabel, useClassLookup } from '@/features/classes/classLookup'
import { formatDate } from '@/lib/dates'
import { getErrorMessage } from '@/lib/serverErrors'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import { ExaminationFormDialog } from '../components/ExaminationFormDialog'
import { ExaminationProgressCell } from '../components/ExaminationProgressCell'
import { useDeleteExaminationMutation, useGetExaminationsQuery } from '../examinationsApi'
import { examTiming, formatDuration, markingProgress } from '../examinationRules'
import type { ExaminationRow } from '../types'

const TIMING_LABEL = {
  past: 'Sat',
  today: 'Today',
  upcoming: 'Upcoming',
} as const

const TIMING_COLOR = {
  past: 'default',
  today: 'warning',
  upcoming: 'info',
} as const

/**
 * `/examinations` — every active examination for the school.
 *
 * The class filter goes to the server, because `?classId=` is the only parameter
 * `sp_GetExaminations` takes. Subject and free-text narrowing are done here on the loaded
 * array, which is honest rather than lazy: the endpoint is unpaged, so the browser really does
 * hold every row and filtering it cannot show a partial answer. (Contrast the Subjects list,
 * which has no client-side name filter precisely because that endpoint *is* paged.)
 */
export default function ExaminationListPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { canCreate, canEdit, canDelete } = useModulePermissions('Examinations')
  const canViewClasses = useCan('Classes', 'View')

  const [classId, setClassId] = useState<number | ''>('')
  const [subjectId, setSubjectId] = useState<number | ''>('')
  const [search, setSearch] = useState('')

  const [editing, setEditing] = useState<ExaminationRow | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ExaminationRow | null>(null)

  const { classes, isLoading: loadingClasses } = useClassLookup({ skip: !canViewClasses })

  const { data, isLoading, isFetching, error, refetch } = useGetExaminationsQuery(
    classId === '' ? {} : { classId },
  )

  const [deleteExamination, { isLoading: deleting }] = useDeleteExaminationMutation()

  // Memoised rather than `data ?? []` inline, because three memos below depend on it and a
  // fresh empty array every render would recompute all three on every keystroke.
  const examinations = useMemo(() => data ?? [], [data])

  /**
   * The subject filter's options come from the examinations themselves rather than from
   * `GET /api/Subjects`. Two reasons: a subject nothing is examined in would be an option that
   * can only ever empty the grid, and this needs no second request and no `Subjects:View`.
   */
  const subjectFilterOptions = useMemo(() => {
    const seen = new Map<number, string>()
    for (const row of examinations) {
      if (!seen.has(row.subjectId)) seen.set(row.subjectId, row.subjectName)
    }
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [examinations])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return examinations.filter((row) => {
      if (subjectId !== '' && row.subjectId !== subjectId) return false
      if (!term) return true
      // Type is searched too: "mid term" is how someone looks for the whole term's exams, and
      // it is not always in the name.
      return (
        row.examName.toLowerCase().includes(term) || row.examType.toLowerCase().includes(term)
      )
    })
  }, [examinations, subjectId, search])

  const stats = useMemo(() => {
    let upcoming = 0
    let awaitingMarks = 0
    for (const row of examinations) {
      if (examTiming(row.examDate) !== 'past') upcoming += 1
      // Only exams already sat count as awaiting marks — an exam next week has no marks
      // outstanding, it simply has not happened.
      else if (!markingProgress(row).complete) awaitingMarks += 1
    }
    return { total: examinations.length, upcoming, awaitingMarks }
  }, [examinations])

  const handleDelete = async () => {
    if (!pendingDelete) return
    const { id, examName } = pendingDelete
    try {
      await deleteExamination(id).unwrap()
      dispatch(toastSuccess(`${examName} deleted.`))
    } catch (caught) {
      dispatch(toastError(getErrorMessage(caught, 'Could not delete the examination.')))
    } finally {
      setPendingDelete(null)
    }
  }

  const columns = useMemo<GridColDef<ExaminationRow>[]>(
    () => [
      {
        field: 'examName',
        headerName: 'Examination',
        flex: 1.4,
        minWidth: 240,
        renderCell: ({ row }) => (
          <Stack spacing={0.25} sx={{ py: 1 }}>
            <Typography variant="body2">{row.examName}</Typography>
            <Typography variant="caption" color="text.secondary">
              {row.examType}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'subjectName',
        headerName: 'Subject',
        flex: 1,
        minWidth: 160,
        renderCell: ({ row }) => (
          <Stack spacing={0.25} sx={{ py: 1 }}>
            <Typography variant="body2">{row.subjectName}</Typography>
            {row.subjectCode && (
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                {row.subjectCode}
              </Typography>
            )}
          </Stack>
        ),
      },
      {
        field: 'className',
        headerName: 'Class',
        width: 120,
        renderCell: ({ row }) => (
          <Tooltip title={`Grade ${row.grade}, section ${row.section}`}>
            <Typography variant="body2">{row.className}</Typography>
          </Tooltip>
        ),
      },
      {
        field: 'examDate',
        headerName: 'Date',
        width: 180,
        renderCell: ({ row }) => {
          const timing = examTiming(row.examDate)
          return (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography variant="body2">{formatDate(row.examDate)}</Typography>
              {timing !== 'past' && (
                <Chip size="small" label={TIMING_LABEL[timing]} color={TIMING_COLOR[timing]} />
              )}
            </Stack>
          )
        },
      },
      {
        field: 'maxMarks',
        headerName: 'Marks',
        width: 120,
        renderCell: ({ row }) => (
          <Stack spacing={0.25} sx={{ py: 1 }}>
            <Typography variant="body2">{row.maxMarks}</Typography>
            <Typography variant="caption" color="text.secondary">
              pass at {row.passingMarks}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'duration',
        headerName: 'Duration',
        width: 110,
        renderCell: ({ row }) => (
          <Typography variant="body2" color={row.duration === null ? 'text.disabled' : undefined}>
            {formatDuration(row.duration)}
          </Typography>
        ),
      },
      {
        field: 'resultsEntered',
        headerName: 'Marking',
        width: 170,
        renderCell: ({ row }) => <ExaminationProgressCell row={row} />,
      },
      {
        field: 'actions',
        headerName: '',
        width: 140,
        sortable: false,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
            <Tooltip title="Mark sheet">
              <IconButton size="small" onClick={() => void navigate(`/examinations/${row.id}`)}>
                <GradingIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {canEdit && (
              // "Edit" is narrower than it looks — the name, type, class and subject are part
              // of the upsert key and cannot change. The dialog says so; the tooltip sets the
              // expectation before it opens.
              <Tooltip title="Edit date, marks and duration">
                <IconButton
                  size="small"
                  onClick={() => {
                    setEditing(row)
                    setFormOpen(true)
                  }}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip title="Delete">
                <IconButton size="small" color="error" onClick={() => setPendingDelete(row)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        ),
      },
    ],
    [canEdit, canDelete, navigate],
  )

  const addButton = (
    <Button
      variant="contained"
      startIcon={<AddIcon />}
      onClick={() => {
        setEditing(null)
        setFormOpen(true)
      }}
    >
      Schedule exam
    </Button>
  )

  const filtersApplied = classId !== '' || subjectId !== '' || search.trim() !== ''

  return (
    <Box>
      <PageHeader
        title="Examinations"
        subtitle="One examination per subject per class. Marks are entered against these, and the mark sheet ranks the class once they are."
        actions={<Can module="Examinations" action="Create">{addButton}</Can>}
      />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 3,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        }}
      >
        <StatCard
          label="Scheduled"
          value={stats.total}
          caption={classId === '' ? 'Active examinations in this school' : 'In the chosen class'}
          icon={FactCheckIcon}
        />
        <StatCard
          label="Still to sit"
          value={stats.upcoming}
          caption="Dated today or later"
          icon={EventAvailableIcon}
          iconColor={stats.upcoming > 0 ? 'info.main' : 'text.disabled'}
        />
        <StatCard
          label="Awaiting marks"
          value={stats.awaitingMarks}
          caption="Already sat, with at least one student unmarked"
          icon={PendingActionsIcon}
          iconColor={stats.awaitingMarks > 0 ? 'warning.main' : 'text.disabled'}
        />
      </Box>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            select
            label="Class"
            size="small"
            value={classId}
            onChange={(event) => {
              const raw = event.target.value
              setClassId(raw === '' ? '' : Number(raw))
              // The subject options are derived from the rows on screen, so a class change can
              // strip the chosen subject out of the list and leave an empty grid behind.
              setSubjectId('')
            }}
            disabled={!canViewClasses || loadingClasses}
            sx={{ minWidth: 220 }}
            helperText={canViewClasses ? 'Filtered by the server' : 'Needs Classes access'}
          >
            <MenuItem value="">
              <em>All classes</em>
            </MenuItem>
            {classes.map((row) => (
              <MenuItem key={row.id} value={row.id}>
                {classLabel(row)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Subject"
            size="small"
            value={subjectId}
            onChange={(event) => {
              const raw = event.target.value
              setSubjectId(raw === '' ? '' : Number(raw))
            }}
            sx={{ minWidth: 200 }}
            helperText="Subjects with an examination"
          >
            <MenuItem value="">
              <em>All subjects</em>
            </MenuItem>
            {subjectFilterOptions.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Search"
            size="small"
            value={search}
            placeholder="Name or type"
            onChange={(event) => setSearch(event.target.value)}
            sx={{ minWidth: 200 }}
            helperText="Filters the loaded list"
          />
        </Stack>
        {isFetching && !isLoading && <LinearProgress sx={{ mt: 2 }} />}
      </Paper>

      <ClientDataGrid<ExaminationRow>
        rows={isLoading ? undefined : rows}
        loading={isLoading || isFetching}
        error={error}
        onRetry={() => void refetch()}
        columns={columns}
        getRowId={(row) => row.id}
        autoHeight
        rowHeight={64}
        initialState={{ sorting: { sortModel: [{ field: 'examDate', sort: 'desc' }] } }}
        emptyTitle={filtersApplied ? 'No examinations match these filters' : 'No examinations yet'}
        emptyDescription={
          filtersApplied
            ? 'Try clearing the class or subject, or widening the search.'
            : 'Schedule one per subject per class. Marks can be entered once it exists.'
        }
        emptyAction={canCreate && !filtersApplied ? addButton : undefined}
      />

      <ExaminationFormDialog
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this examination?"
        destructive
        busy={deleting}
        confirmLabel="Delete"
        message={
          <Stack spacing={1.5}>
            <Typography variant="body2">
              {pendingDelete?.examName} will be removed from the examination list.
            </Typography>
            {pendingDelete && pendingDelete.resultsEntered > 0 ? (
              // The count is the whole point of this confirmation. sp_DeleteExamination
              // deactivates every result in the same transaction, so this is not a tidy-up —
              // it withdraws marks that have been entered, and possibly already reported.
              <Typography variant="body2" color="error.main">
                {pendingDelete.resultsEntered} entered mark
                {pendingDelete.resultsEntered === 1 ? '' : 's'} will be withdrawn with it, and
                will stop appearing in student results.
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No marks have been entered against it, so nothing else is affected.
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              The records are deactivated rather than erased, so this is recoverable in the
              database — but not from this screen.
            </Typography>
          </Stack>
        }
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </Box>
  )
}
