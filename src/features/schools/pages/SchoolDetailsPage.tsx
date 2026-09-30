import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { useAppDispatch } from '@/app/hooks'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { PageHeader } from '@/components/layout/PageHeader'
import { Can } from '@/features/auth/Can'
import { getErrorMessage, getErrorStatus } from '@/lib/serverErrors'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import { useGetSchoolQuery, useUpdateSchoolStatusMutation } from '../schoolsApi'
import { SchoolAdminDialog } from '../components/SchoolAdminDialog'
import { SchoolEditDialog } from '../components/SchoolEditDialog'
import { SchoolProfile } from '../components/SchoolProfile'

/**
 * One tenant's record: `GET /api/Schools/{id}`.
 *
 * What is *not* here is the point of the module. There are no students, teachers or
 * classes on this page, because a platform administrator does not manage them —
 * `StudentsController` and the rest are `[Authorize(Roles = "Admin")]`, and a SuperAdmin
 * holds no such role. The school's own administrator signs in and does that work. This
 * page therefore ends at the tenant record, its administrators, and its status.
 */
export default function SchoolDetailsPage() {
  const params = useParams<{ schoolId: string }>()
  const schoolId = Number(params.schoolId)
  const validId = Number.isInteger(schoolId) && schoolId > 0

  const dispatch = useAppDispatch()
  const [editOpen, setEditOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)

  const { data: school, isLoading, error, refetch } = useGetSchoolQuery(schoolId, {
    skip: !validId,
  })
  const [updateStatus, { isLoading: savingStatus }] = useUpdateSchoolStatusMutation()

  const handleConfirmStatus = async () => {
    if (!school) return
    const suspending = school.isActive
    try {
      await updateStatus({ schoolId: school.id, isActive: !suspending }).unwrap()
      dispatch(toastSuccess(`${school.schoolName} ${suspending ? 'suspended' : 'restored'}.`))
    } catch (caught) {
      dispatch(toastError(getErrorMessage(caught, 'Could not change the school status.')))
    } finally {
      setStatusOpen(false)
    }
  }

  const backButton = (
    <Button component={RouterLink} to="/schools" startIcon={<ArrowBackIcon />} size="small">
      Schools
    </Button>
  )

  if (!validId) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">That is not a valid school reference.</Alert>
      </Box>
    )
  }

  if (isLoading) return <FullPageLoader label="Loading the school…" />

  if (error) {
    // The API answers 404, not 403, for a school this caller may not read — so ids
    // cannot be probed to discover which tenants exist. That means this page genuinely
    // cannot tell "no such school" from "not yours", and should not pretend to.
    if (getErrorStatus(error) === 404) {
      return (
        <Box sx={{ py: 4 }}>
          <EmptyState
            title="No such school"
            description="It may never have existed, or it may not be one you can read."
            action={backButton}
          />
        </Box>
      )
    }
    return (
      <Box sx={{ py: 4 }}>
        <ErrorState
          error={error}
          title="Could not load this school"
          onRetry={() => void refetch()}
        />
      </Box>
    )
  }

  if (!school) {
    return (
      <Box sx={{ py: 4 }}>
        <EmptyState title="No such school" action={backButton} />
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ mt: 2 }}>{backButton}</Box>

      <PageHeader
        title={school.schoolName}
        subtitle={`Code ${school.schoolCode}${school.subdomain ? ` · ${school.subdomain}` : ''}`}
        actions={
          <>
            <Can module="Schools" action="Edit">
              <Button
                variant="outlined"
                startIcon={<EditOutlinedIcon />}
                onClick={() => setEditOpen(true)}
              >
                Edit
              </Button>
            </Can>
            <Can module="Schools" action="Create">
              <Button
                variant="outlined"
                startIcon={<PersonAddAltOutlinedIcon />}
                onClick={() => setAdminOpen(true)}
              >
                Add administrator
              </Button>
            </Can>
            <Can module="Schools" action="Edit">
              <Button
                variant={school.isActive ? 'outlined' : 'contained'}
                color={school.isActive ? 'warning' : 'primary'}
                startIcon={school.isActive ? <BlockOutlinedIcon /> : <RestartAltIcon />}
                onClick={() => setStatusOpen(true)}
              >
                {school.isActive ? 'Suspend' : 'Restore'}
              </Button>
            </Can>
          </>
        }
      />

      <Stack spacing={3}>
        {!school.isActive && (
          <Alert severity="warning">
            <AlertTitle>This school is suspended</AlertTitle>
            Nobody at {school.schoolName} can sign in, and its refresh tokens were revoked
            when it was suspended. Its records are untouched and restoring it brings every
            account back.
          </Alert>
        )}

        <SchoolProfile school={school} />

        <Alert severity="info">
          <AlertTitle>Who manages what</AlertTitle>
          Students, teachers, classes, attendance, examinations and fees belong to this
          school's own administrator, who signs in with the {school.schoolCode}_ADMIN
          account. Platform administration stops at this record — the API refuses the
          tenant modules to any account without this school's <strong>Admin</strong> role,
          so there is nothing here that could reach them.
        </Alert>
      </Stack>

      {editOpen && (
        <SchoolEditDialog open school={school} onClose={() => setEditOpen(false)} />
      )}

      {adminOpen && (
        <SchoolAdminDialog open school={school} onClose={() => setAdminOpen(false)} />
      )}

      <ConfirmDialog
        open={statusOpen}
        title={school.isActive ? 'Suspend this school?' : 'Restore this school?'}
        destructive={school.isActive}
        busy={savingStatus}
        confirmLabel={school.isActive ? 'Suspend' : 'Restore'}
        message={
          school.isActive ? (
            <Stack spacing={1.5}>
              <Typography variant="body2">
                Everyone at {school.schoolName} is signed out immediately and cannot sign
                back in. Their refresh tokens are revoked, so no session survives on a
                token issued earlier.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Nothing is deleted — students, results and fee records stay as they are.
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2">
              {school.schoolName} becomes reachable again and its accounts can sign in.
            </Typography>
          )
        }
        onConfirm={() => void handleConfirmStatus()}
        onCancel={() => setStatusOpen(false)}
      />
    </Box>
  )
}
