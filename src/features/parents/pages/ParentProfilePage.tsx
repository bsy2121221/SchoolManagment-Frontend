import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EscalatorWarningOutlinedIcon from '@mui/icons-material/EscalatorWarningOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { StatCard } from '@/components/data/StatCard'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { PageHeader } from '@/components/layout/PageHeader'
import { Can } from '@/features/auth/Can'
import { useCan } from '@/features/auth/permissions'
import { ParentChildrenPanel } from '../components/ParentChildrenPanel'
import { ParentFormDialog } from '../components/ParentFormDialog'
import { useGetParentProfileQuery } from '../parentsApi'

/** A timestamp from the API, or an em dash when it is absent or unparseable. */
function dateOrDash(value: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString()
}

function moneyOrDash(amount: number | null): string {
  if (amount === null) return '—'
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** One row of the details table. */
function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <TableRow>
      <TableCell sx={{ width: 170, color: 'text.secondary', border: 0, py: 0.75 }}>
        {label}
      </TableCell>
      <TableCell sx={{ border: 0, py: 0.75 }}>{value || '—'}</TableCell>
    </TableRow>
  )
}

/**
 * One parent, their contact details and the children attached to them.
 *
 * There is no parent statistics procedure -- nothing answering to `sp_GetTeacherProfile`'s
 * second result set -- so the figures at the top are counted off the profile itself rather
 * than fetched. The children are the substance of this screen, and they are the only thing
 * that decides what the parent can see when they sign in.
 */
export default function ParentProfilePage() {
  // The route is keyed on Users.Id, not Parents.Id: `sp_GetParentProfile` takes @UserId,
  // and this screen is the thing that can only be fetched by it. Everything inside uses
  // Parents.Id, which the profile response carries as `id`.
  const params = useParams<{ userId: string }>()
  const userId = Number(params.userId)
  const [editOpen, setEditOpen] = useState(false)

  const validId = Number.isInteger(userId) && userId > 0

  const { data, isLoading, error, refetch } = useGetParentProfileQuery(userId, { skip: !validId })

  const canEditParents = useCan('Parents', 'Edit')

  if (!validId) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">That is not a valid parent reference.</Alert>
      </Box>
    )
  }

  if (isLoading) return <FullPageLoader label="Loading the parent…" />

  if (error) {
    return (
      <Box sx={{ py: 4 }}>
        <ErrorState
          error={error}
          title="Could not load this parent"
          onRetry={() => void refetch()}
        />
      </Box>
    )
  }

  if (!data) {
    return (
      <Box sx={{ py: 4 }}>
        <EmptyState
          title="No such parent"
          description="They may belong to a different school, or never have existed. A deactivated parent does open here, so this is not what a deleted account looks like."
          action={
            <Button component={RouterLink} to="/parents" startIcon={<ArrowBackIcon />}>
              Back to parents
            </Button>
          }
        />
      </Box>
    )
  }

  const fullName = `${data.firstName} ${data.lastName}`.trim() || data.username
  const children = data.children

  return (
    <Box>
      <Button
        component={RouterLink}
        to="/parents"
        startIcon={<ArrowBackIcon />}
        size="small"
        sx={{ mt: 2 }}
      >
        Parents
      </Button>

      <PageHeader
        title={fullName}
        subtitle={`Signs in as ${data.username}${data.occupation ? ` · ${data.occupation}` : ''}`}
        actions={
          <Can module="Parents" action="Edit">
            <Button
              variant="outlined"
              startIcon={<EditOutlinedIcon />}
              onClick={() => setEditOpen(true)}
            >
              Edit
            </Button>
          </Can>
        }
      />

      {!data.isActive && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This account is deactivated: the parent cannot sign in, and their children were
          detached when it happened. There is no reactivate endpoint, so restoring their access
          means registering them again.
        </Alert>
      )}

      {data.requirePasswordChange && data.isActive && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This parent has not changed the password their account was created with, so they have
          not signed in yet.
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 3,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        }}
      >
        <StatCard
          label="Children"
          value={children.length}
          icon={EscalatorWarningOutlinedIcon}
          caption={
            children.length === 0
              ? 'Nobody attached — every screen is empty for them'
              : 'Whose attendance, results and fees they can see'
          }
        />

        <StatCard
          label="Account"
          value={data.isActive ? 'Active' : 'Deactivated'}
          icon={BadgeOutlinedIcon}
          iconColor={data.isActive ? 'success.main' : 'text.disabled'}
          caption={
            data.requirePasswordChange
              ? 'Still on the password it was created with'
              : 'Password has been changed at least once'
          }
        />

        <StatCard
          label="Annual income"
          value={moneyOrDash(data.annualIncome)}
          icon={PaymentsOutlinedIcon}
          iconColor="warning.main"
          // A null income is nobody having asked, not an income of nothing -- and it is
          // usually what fee concessions are decided on, so the distinction matters.
          caption={data.annualIncome === null ? 'Not recorded' : 'As declared on the record'}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '3fr 2fr' },
          alignItems: 'start',
        }}
      >
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
            Details
          </Typography>
          <Table size="small">
            <TableBody>
              <DetailRow label="Email" value={data.email} />
              <DetailRow label="Phone" value={data.phoneNumber} />
              <DetailRow label="Address" value={data.address} />
              <DetailRow label="Occupation" value={data.occupation} />
              <DetailRow
                label="Annual income"
                value={data.annualIncome === null ? null : moneyOrDash(data.annualIncome)}
              />
            </TableBody>
          </Table>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
            Account
          </Typography>
          <Table size="small">
            <TableBody>
              <DetailRow label="Username" value={data.username} />
              <DetailRow label="School" value={data.schoolName} />
              <DetailRow label="Registered" value={dateOrDash(data.createdAt)} />
              <DetailRow label="Last updated" value={dateOrDash(data.updatedAt)} />
            </TableBody>
          </Table>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            The username is allocated by the server from the school code and the parent’s name,
            and never changes — not even when the name is corrected here.
          </Typography>
        </Paper>
      </Box>

      <Box sx={{ mt: 2 }}>
        <ParentChildrenPanel parentId={data.id} userId={data.userId} canEdit={canEditParents} />
      </Box>

      <ParentFormDialog open={editOpen} editing={data} onClose={() => setEditOpen(false)} />
    </Box>
  )
}
