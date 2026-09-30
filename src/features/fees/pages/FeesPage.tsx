import GroupAddIcon from '@mui/icons-material/GroupAdd'
import PersonSearchIcon from '@mui/icons-material/PersonSearch'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import { useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Can } from '@/features/auth/Can'
import { useCan } from '@/features/auth/permissions'
import { BillFeeDialog } from '../components/BillFeeDialog'
import { CollectionTab } from '../components/CollectionTab'
import { FeeTypesTab } from '../components/FeeTypesTab'
import { LedgerTab } from '../components/LedgerTab'
import { OutstandingTab } from '../components/OutstandingTab'

const TABS = [
  { key: 'outstanding', label: 'Outstanding' },
  { key: 'collection', label: 'Collection' },
  { key: 'payments', label: 'Payments' },
  { key: 'types', label: 'Fee types' },
] as const

type TabKey = (typeof TABS)[number]['key']

function isTabKey(value: string | null): value is TabKey {
  return TABS.some((tab) => tab.key === value)
}

/**
 * `/fees` — the school's finance desk.
 *
 * Four tabs, one per question: who owes what, how much of each month's billing has come in,
 * what was received between two dates, and what the school charges for. The tab is in the URL
 * (`?tab=`) so a link to "the outstanding list" is a link to the outstanding list.
 *
 * A student's own account — billing one student, recording a payment, refunding — lives at
 * `/fees/students/:studentId`, reached from any student's name here or from their profile.
 * There is no student search on this page because `Students` already has one; "Find a student"
 * goes there.
 */
export default function FeesPage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: TabKey = isTabKey(requested) ? requested : 'outstanding'

  const canViewStudents = useCan('Students', 'View')
  const [billClassOpen, setBillClassOpen] = useState(false)

  return (
    <Box>
      <PageHeader
        title="Fees"
        subtitle="Billing, payments and what is still owed"
        actions={
          <Stack direction="row" spacing={1}>
            {canViewStudents && (
              <Button
                variant="outlined"
                component={RouterLink}
                to="/students"
                startIcon={<PersonSearchIcon />}
              >
                Find a student
              </Button>
            )}
            <Can module="Fees" action="Create">
              <Button
                variant="contained"
                startIcon={<GroupAddIcon />}
                onClick={() => setBillClassOpen(true)}
              >
                Bill a class
              </Button>
            </Can>
          </Stack>
        }
      />

      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_event, value: TabKey) => setParams({ tab: value }, { replace: true })}
          variant="scrollable"
          allowScrollButtonsMobile
        >
          {TABS.map((item) => (
            <Tab key={item.key} value={item.key} label={item.label} />
          ))}
        </Tabs>
      </Paper>

      {tab === 'outstanding' && <OutstandingTab />}
      {tab === 'collection' && <CollectionTab />}
      {tab === 'payments' && <LedgerTab />}
      {tab === 'types' && <FeeTypesTab />}

      <BillFeeDialog
        open={billClassOpen}
        target={{ kind: 'class' }}
        onClose={() => setBillClassOpen(false)}
      />
    </Box>
  )
}
