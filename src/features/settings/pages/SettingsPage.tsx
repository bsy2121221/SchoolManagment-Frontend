import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SaveIcon from '@mui/icons-material/Save'
import { useMemo, useState } from 'react'
import { useBlocker, useSearchParams } from 'react-router-dom'
import { useAppDispatch } from '@/app/hooks'
import { Can } from '@/features/auth/Can'
import { useCurrentUser, useIsSuperAdmin, useModulePermissions } from '@/features/auth/permissions'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { PageHeader } from '@/components/layout/PageHeader'
import { getErrorMessage } from '@/lib/serverErrors'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import { AddSettingDialog } from '../components/AddSettingDialog'
import { GradeScaleCard } from '../components/GradeScaleCard'
import { ActingAsBanner, SchoolPicker } from '../components/SchoolScopePanel'
import { SettingsCategoryPanel } from '../components/SettingsCategoryPanel'
import {
  ACADEMIC_CATEGORY,
  SEEDED_CATEGORIES,
  categoryLabel,
  dataTypeOf,
  groupByCategory,
  rowKey,
  validateValue,
} from '../settingRules'
import {
  useDeleteSettingMutation,
  useGetSettingsQuery,
  useResetSettingsMutation,
  useSaveSettingsMutation,
} from '../settingsApi'
import type { SettingRow, SkippedSetting } from '../types'

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

const NO_ROWS: SettingRow[] = []

type Draft = Record<string, string>

/** Drops the draft entries that now match what is stored, i.e. the ones a save has written. */
function prune(draft: Draft, rows: readonly SettingRow[]): Draft {
  const stored = new Map(rows.map((row) => [rowKey(row), row.settingValue]))
  return Object.fromEntries(
    Object.entries(draft).filter(([key, value]) => stored.has(key) && stored.get(key) !== value),
  )
}

/**
 * /settings: the school's settings, for whoever holds Settings:View, which the seed grants
 * to Admin and SuperAdmin.
 *
 * The school always comes from the token, so the page first establishes that there is one.
 * A school administrator always has theirs. A platform administrator has none until they
 * switch into a school, so they get a picker first, and the editor once switched. The editor
 * is keyed on the school id, so switching school (or the scope lapsing at a token refresh)
 * starts from a clean draft instead of carrying one school's edits into another.
 */
export default function SettingsPage() {
  const user = useCurrentUser()
  const isSuperAdmin = useIsSuperAdmin()
  const schoolId = user?.schoolId ?? null

  if (schoolId === null) {
    return (
      <>
        <PageHeader title="Settings" subtitle="School-level configuration" />
        {isSuperAdmin ? (
          <SchoolPicker />
        ) : (
          <EmptyState
            title="No school on this account"
            description="Settings belong to a school, and your account is not attached to one."
          />
        )}
      </>
    )
  }

  return <SchoolSettingsEditor key={schoolId} actingAsSchool={isSuperAdmin} />
}

interface SchoolSettingsEditorProps {
  /** A SuperAdmin switched into the school, as opposed to the school's own administrator. */
  actingAsSchool: boolean
}

/**
 * The editor proper.
 *
 * Edits collect in a draft that spans every tab, so moving between categories loses
 * nothing, and Save writes all of them in one bulk request. The bulk endpoint **skips** a
 * row it cannot store rather than failing the batch, so a 200 can still leave rows unsaved;
 * those stay in the draft, highlighted, with the server's reason listed above them.
 */
function SchoolSettingsEditor({ actingAsSchool }: SchoolSettingsEditorProps) {
  const dispatch = useAppDispatch()
  const user = useCurrentUser()
  const permissions = useModulePermissions('Settings')
  const [params, setParams] = useSearchParams()

  const { data, isLoading, error, refetch } = useGetSettingsQuery()
  const rows = data ?? NO_ROWS
  const groups = useMemo(() => groupByCategory(rows), [rows])

  const [saveSettings, { isLoading: saving }] = useSaveSettingsMutation()
  const [deleteSetting, { isLoading: deleting }] = useDeleteSettingMutation()
  const [resetSettings, { isLoading: resetting }] = useResetSettingsMutation()

  const [draft, setDraft] = useState<Draft>({})
  const [skipped, setSkipped] = useState<SkippedSetting[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SettingRow | null>(null)
  /** `undefined` is "no dialog"; `null` is "reset every category". */
  const [resetTarget, setResetTarget] = useState<string | null | undefined>(undefined)

  // When the list is re-read (after a save, a reset or the 30-second refetch), drop the
  // entries it has caught up with. Adjusting state during render, as React recommends over
  // an effect, so there is never a frame showing the old value without the draft over it.
  const [seenRows, setSeenRows] = useState(rows)
  if (rows !== seenRows) {
    setSeenRows(rows)
    setDraft((current) => prune(current, rows))
  }

  const changes = rows.filter((row) => {
    const value = draft[rowKey(row)]
    return value !== undefined && value !== row.settingValue
  })
  const invalidCount = changes.filter(
    (row) => validateValue(dataTypeOf(row), draft[rowKey(row)] ?? '') !== null,
  ).length
  const dirty = changes.length > 0

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  )

  const requested = params.get('tab')
  const active = groups.find((group) => group.category === requested) ?? groups[0]
  const changedIn = (category: string) => changes.filter((row) => row.category === category).length

  const setValue = (row: SettingRow, value: string) =>
    setDraft((current) => ({ ...current, [rowKey(row)]: value }))

  const revert = (row: SettingRow) =>
    setDraft((current) => {
      const next = { ...current }
      delete next[rowKey(row)]
      return next
    })

  const handleSave = async () => {
    setSkipped([])
    try {
      const result = await saveSettings(
        changes.map((row) => ({
          category: row.category,
          settingKey: row.settingKey,
          settingValue: draft[rowKey(row)] ?? row.settingValue,
          // Both sent as stored: a bulk entry without a type is saved as a string, and the
          // description is part of the row the procedure writes back.
          dataType: dataTypeOf(row),
          description: row.description,
        })),
      ).unwrap()

      if (result.settingsSkipped > 0) {
        setSkipped(result.skipped)
        dispatch(
          toastError(
            `${plural(result.settingsSaved, 'setting')} saved, ${result.settingsSkipped} not saved.`,
          ),
        )
      } else {
        dispatch(toastSuccess(`${plural(result.settingsSaved, 'setting')} saved.`))
      }
    } catch (caught) {
      dispatch(toastError(getErrorMessage(caught, 'Could not save the settings.')))
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteSetting({
        category: deleteTarget.category,
        settingKey: deleteTarget.settingKey,
      }).unwrap()
      revert(deleteTarget)
      dispatch(toastSuccess(`${deleteTarget.settingKey} deleted.`))
      setDeleteTarget(null)
    } catch (caught) {
      dispatch(toastError(getErrorMessage(caught, 'Could not delete the setting.')))
    }
  }

  const handleReset = async () => {
    if (resetTarget === undefined) return
    try {
      await resetSettings({ category: resetTarget }).unwrap()
      // The reset rewrote these rows, so edits made to them are meaningless now.
      setDraft((current) =>
        resetTarget === null
          ? {}
          : Object.fromEntries(
              Object.entries(current).filter(
                ([key]) => !key.startsWith(`${resetTarget.toLowerCase()}\u0000`),
              ),
            ),
      )
      setSkipped([])
      dispatch(
        toastSuccess(
          resetTarget === null
            ? 'All settings restored to their defaults.'
            : `${categoryLabel(resetTarget)} restored to its defaults.`,
        ),
      )
      setResetTarget(undefined)
    } catch (caught) {
      dispatch(toastError(getErrorMessage(caught, 'Could not reset the settings.')))
    }
  }

  const resetEditsLost =
    resetTarget === undefined ? 0 : resetTarget === null ? changes.length : changedIn(resetTarget)

  const header = (
    <PageHeader
      title="Settings"
      subtitle={user?.schoolName ? `Configuration for ${user.schoolName}` : 'School-level configuration'}
      actions={
        <Stack direction="row" spacing={1}>
          <Can module="Settings" action="Delete">
            <Button
              variant="outlined"
              color="error"
              startIcon={<RestartAltIcon />}
              disabled={rows.length === 0}
              onClick={() => setResetTarget(null)}
            >
              Reset all
            </Button>
          </Can>
          <Can module="Settings" action="Create">
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
              Add setting
            </Button>
          </Can>
        </Stack>
      }
    />
  )

  let body
  if (isLoading) {
    body = (
      <Stack spacing={1}>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} variant="rounded" height={64} />
        ))}
      </Stack>
    )
  } else if (error) {
    body = <ErrorState error={error} title="Could not load the settings" onRetry={refetch} />
  } else if (!active) {
    body = (
      <EmptyState
        title="This school has no settings"
        description="The defaults are seeded when a school is created. Restoring them recreates every setting."
        action={
          permissions.canDelete ? (
            <Button variant="contained" startIcon={<RestartAltIcon />} onClick={() => setResetTarget(null)}>
              Restore defaults
            </Button>
          ) : undefined
        }
      />
    )
  } else {
    const isAcademic = active.category === ACADEMIC_CATEGORY
    const isSeeded = SEEDED_CATEGORIES.some((c) => c.key === active.category)

    body = (
      <>
        <Paper variant="outlined" sx={{ mb: 2 }}>
          <Tabs
            value={active.category}
            onChange={(_event, value: string) => setParams({ tab: value }, { replace: true })}
            variant="scrollable"
            allowScrollButtonsMobile
          >
            {groups.map((group) => {
              const count = changedIn(group.category)
              return (
                <Tab
                  key={group.category}
                  value={group.category}
                  label={count > 0 ? `${group.label} (${count})` : group.label}
                />
              )
            })}
          </Tabs>
        </Paper>

        {skipped.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setSkipped([])}>
            <AlertTitle>Some settings were not saved</AlertTitle>
            They are still marked as changed below. Correct them and save again.
            <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
              {skipped.map((item) => (
                <li key={`${item.category}/${item.settingKey}`}>
                  <strong>{item.settingKey}</strong> ({categoryLabel(item.category)}): {item.reason}
                </li>
              ))}
            </Box>
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', lg: isAcademic ? 'minmax(0, 2fr) minmax(0, 1fr)' : '1fr' },
            alignItems: 'start',
          }}
        >
          <Stack spacing={1.5}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
            >
              <Typography variant="body2" color="text.secondary">
                {isAcademic
                  ? 'The grade thresholds here decide the letter grade of every mark saved without one.'
                  : 'Nothing in the system reads these settings yet. They are kept for the school’s records.'}
              </Typography>
              {permissions.canDelete && isSeeded && (
                <Button
                  size="small"
                  color="error"
                  startIcon={<RestartAltIcon />}
                  onClick={() => setResetTarget(active.category)}
                  sx={{ flexShrink: 0 }}
                >
                  Reset {active.label}
                </Button>
              )}
            </Stack>

            <SettingsCategoryPanel
              rows={active.rows}
              draft={draft}
              canEdit={permissions.canEdit}
              canDelete={permissions.canDelete}
              onChange={setValue}
              onRevert={revert}
              onDelete={setDeleteTarget}
            />
          </Stack>

          {isAcademic && <GradeScaleCard />}
        </Box>

        {dirty && (
          <Paper
            elevation={6}
            sx={{
              position: 'sticky',
              bottom: 16,
              mt: 2,
              px: 2,
              py: 1.5,
              display: 'flex',
              gap: 2,
              alignItems: 'center',
              flexWrap: 'wrap',
              zIndex: 1,
            }}
          >
            <Typography variant="body2" sx={{ flex: 1 }}>
              {plural(changes.length, 'unsaved change')}
              {invalidCount > 0 && ` · ${invalidCount} not valid`}
            </Typography>
            <Button onClick={() => setDraft({})} disabled={saving}>
              Discard
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={saving || invalidCount > 0 || !permissions.canEdit}
              onClick={handleSave}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </Paper>
        )}
      </>
    )
  }

  return (
    <>
      {header}
      {actingAsSchool && (
        <ActingAsBanner schoolName={user?.schoolName ?? null} schoolCode={user?.schoolCode ?? null} disabled={dirty} />
      )}
      {!permissions.canEdit && rows.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You can read these settings but not change them.
        </Alert>
      )}
      {body}

      <AddSettingDialog
        open={addOpen}
        defaultCategory={active?.category ?? SEEDED_CATEGORIES[0].key}
        onClose={() => setAddOpen(false)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete ${deleteTarget?.settingKey ?? 'this setting'}?`}
        message="The setting is removed from this school. Resetting its category to the defaults brings a seeded setting back."
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={resetTarget !== undefined}
        title={
          resetTarget === null
            ? 'Reset every setting to its default?'
            : `Reset ${categoryLabel(resetTarget ?? '')} to its defaults?`
        }
        message={
          <>
            Every setting in {resetTarget === null ? 'every category' : 'this category'} is deleted
            and recreated with its seeded value. Customised values, and settings added by hand,
            cannot be recovered.
            {resetEditsLost > 0 && ` Your ${plural(resetEditsLost, 'unsaved change')} will be discarded.`}
          </>
        }
        confirmLabel="Reset"
        destructive
        busy={resetting}
        onConfirm={handleReset}
        onCancel={() => setResetTarget(undefined)}
      />

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Leave without saving?"
        message={`${plural(changes.length, 'setting')} changed and not saved.`}
        confirmLabel="Leave"
        cancelLabel="Stay"
        destructive
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </>
  )
}
