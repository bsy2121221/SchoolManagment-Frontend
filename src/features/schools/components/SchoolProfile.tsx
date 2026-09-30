import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { monthName } from '../types'
import type { School } from '../types'

/** One label/value pair. Values are nodes so a missing one can be styled as absent. */
function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Box>
  )
}

const ABSENT = (
  <Typography component="span" variant="body2" color="text.disabled">
    Not recorded
  </Typography>
)

function orAbsent(value: string | null): ReactNode {
  return value && value.trim() !== '' ? value : ABSENT
}

/** A timestamp from the API, rendered in the reader's locale. */
function timestamp(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString()
}

const COLUMNS_SX = {
  display: 'grid',
  gap: 2.5,
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
} as const

interface SchoolProfileProps {
  school: School
  /**
   * The month the academic year starts is presented differently depending on who is
   * reading. A platform administrator sees a setting; a school admin sees a fact about
   * their own calendar, which is worth a word of consequence.
   */
  explainAcademicYear?: boolean
}

/**
 * One school's stored record, read-only.
 *
 * Shared by the platform details page and a school admin's own view of themselves, so
 * the two cannot drift into showing different fields for the same row. The actions
 * differ between those screens and live on them, not here.
 */
export function SchoolProfile({ school, explainAcademicYear = false }: SchoolProfileProps) {
  const location = [school.address, school.city, school.state, school.postalCode, school.country]
    .filter((part) => part && part.trim() !== '')
    .join(', ')

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2.5 }}>
          <Avatar
            src={school.logoUrl ?? undefined}
            // The stored theme colour is the school's own branding, so the placeholder
            // uses it rather than an app colour the school never chose.
            sx={{ width: 56, height: 56, bgcolor: school.themeColor }}
            alt=""
          >
            {school.schoolCode.slice(0, 2)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ wordBreak: 'break-word' }}>
              {school.schoolName}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {school.schoolCode}
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ mb: 2.5 }} />

        <Box sx={COLUMNS_SX}>
          <Field
            label="Subdomain"
            value={
              school.subdomain ? (
                <Box component="span" sx={{ fontFamily: 'monospace' }}>
                  {school.subdomain}
                </Box>
              ) : (
                ABSENT
              )
            }
          />
          <Field label="Principal" value={orAbsent(school.principalName)} />
          <Field
            label="Academic year starts"
            value={
              explainAcademicYear
                ? `${monthName(school.academicYearStartMonth)} — sessions are named from this month`
                : monthName(school.academicYearStartMonth)
            }
          />

          <Field label="Contact email" value={orAbsent(school.contactEmail)} />
          <Field label="Contact phone" value={orAbsent(school.contactPhone)} />
          <Field
            label="Theme colour"
            value={
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: 0.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: school.themeColor,
                    flexShrink: 0,
                  }}
                />
                <Box component="span" sx={{ fontFamily: 'monospace' }}>
                  {school.themeColor}
                </Box>
              </Stack>
            }
          />

          <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
            <Field label="Address" value={location === '' ? ABSENT : location} />
          </Box>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Box sx={COLUMNS_SX}>
          <Field label="Created" value={timestamp(school.createdAt)} />
          <Field label="Last updated" value={timestamp(school.updatedAt)} />
          <Field
            label="Status"
            value={
              school.isActive ? (
                'Active'
              ) : (
                <Typography component="span" variant="body2" color="warning.main">
                  Suspended
                </Typography>
              )
            }
          />
        </Box>
      </Paper>
    </Stack>
  )
}
