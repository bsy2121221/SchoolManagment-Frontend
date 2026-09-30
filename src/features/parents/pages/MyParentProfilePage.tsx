import EscalatorWarningOutlinedIcon from '@mui/icons-material/EscalatorWarningOutlined'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'
import { StatCard } from '@/components/data/StatCard'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { PageHeader } from '@/components/layout/PageHeader'
import { useCan } from '@/features/auth/permissions'
import { useGetMyParentProfileQuery } from '../parentsApi'

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
 * A parent's view of their own record and their children.
 *
 * Like the teacher's own screen, this exists because of a gap in the seeded permission grid
 * rather than in spite of it: the Parent role has **no `Parents` permission row at all**, so
 * a parent cannot open `/parents` or anybody's profile, including their own by user id.
 * `GET /parents/my-profile` is gated on the role instead of the grid, which makes this the
 * one parent screen they can reach -- and why the route is guarded by role, with no `module`.
 *
 * **Read-only, and that is the API rather than a decision made here.** `ParentsController`
 * exposes no `PUT my-profile`: there is a `GET`, and nothing else a parent may call about
 * themselves. A teacher can correct their own phone number; a parent has to ask the school
 * office. An edit form here would be a form with nowhere to submit to.
 *
 * The children come from this one response. `GET /parents/{parentId}/children` would be the
 * natural call and it is Admin/Teacher-only on purpose -- it is keyed on `Parents.Id`, so a
 * parent who could call it could walk the ids and read other families' children.
 */
export default function MyParentProfilePage() {
  const { data, isLoading, error, refetch } = useGetMyParentProfileQuery()

  // The seeded Parent role holds Students:View, but the grid is editable per school, so a
  // link that would land on /forbidden is not offered.
  const canViewStudents = useCan('Students', 'View')

  if (isLoading) return <FullPageLoader label="Loading your details…" />

  if (error) {
    return (
      <Box sx={{ py: 4 }}>
        <ErrorState error={error} title="Could not load your details" onRetry={() => void refetch()} />
      </Box>
    )
  }

  if (!data) {
    return (
      <Box sx={{ py: 4 }}>
        <EmptyState
          title="No parent record"
          description="Your sign-in is a parent's, but no parent record is attached to it. The school office has to put that right."
        />
      </Box>
    )
  }

  const fullName = `${data.firstName} ${data.lastName}`.trim() || data.username
  const children = data.children

  return (
    <Box>
      <PageHeader
        title={fullName}
        subtitle={`You sign in as ${data.username}${data.schoolName ? ` · ${data.schoolName}` : ''}`}
      />

      {data.requirePasswordChange && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You are still using the password your account was created with. Change it from the
          account menu.
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mb: 3,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
        }}
      >
        <StatCard
          label="My children"
          value={children.length}
          icon={EscalatorWarningOutlinedIcon}
          caption={
            children.length === 0
              ? 'Nobody attached to your account yet — ask the school office'
              : 'Whose attendance, results and fees you can see'
          }
        />
        <StatCard
          label="School"
          value={data.schoolName ?? '—'}
          caption={data.schoolCode ? `Code ${data.schoolCode}` : 'No school code on file'}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '2fr 3fr' },
          alignItems: 'start',
        }}
      >
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
            My details
          </Typography>
          <Table size="small">
            <TableBody>
              <DetailRow label="Username" value={data.username} />
              <DetailRow label="Email" value={data.email} />
              <DetailRow label="Phone" value={data.phoneNumber} />
              <DetailRow label="Address" value={data.address} />
              <DetailRow label="Occupation" value={data.occupation} />
            </TableBody>
          </Table>
          {/* Said plainly rather than left to be discovered: there is no PUT for a parent's
              own record, so there is no edit button to look for. */}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            These details are held by the school office and cannot be changed here. Ask them to
            correct anything that is wrong. Your password is yours to change, from the account
            menu.
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            My children
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
            Attached by the school office. Everything else you can see in the app is about these
            children.
          </Typography>

          {children.length === 0 ? (
            <EmptyState
              title="Nobody attached yet"
              description="Until the school attaches your children to your account, every other screen will be empty for you. The office can do it in a moment."
            />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Child</TableCell>
                  <TableCell>Class</TableCell>
                  <TableCell>Relationship</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {children.map((child) => {
                  const name = `${child.firstName} ${child.lastName}`.trim()
                  return (
                    <TableRow key={child.studentId} hover>
                      <TableCell>
                        <Stack sx={{ py: 0.5 }}>
                          {canViewStudents ? (
                            <Link
                              component={RouterLink}
                              to={`/students/${child.studentId}`}
                              underline="hover"
                            >
                              {name}
                            </Link>
                          ) : (
                            <Typography variant="body2">{name}</Typography>
                          )}
                          <Typography variant="caption" color="text.secondary">
                            {child.studentNumber}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {/* '' rather than null for a child between classes -- that is what
                            the procedure sends, and it means "not placed yet". */}
                        {child.className === '' ? (
                          <Typography variant="body2" color="text.disabled">
                            Not in a class
                          </Typography>
                        ) : (
                          child.className
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" variant="outlined" label={child.relationship} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </Paper>
      </Box>
    </Box>
  )
}
