import CheckIcon from '@mui/icons-material/Check'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { TEMP_PASSWORD } from '@/types/enums'

/** One labelled, monospaced, copyable value. */
function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      // Revert the tick so a second copy of the same value still gives feedback.
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard access can be refused (insecure origin, permissions policy). The
      // value is on screen and selectable, so failing quietly is enough -- claiming
      // "copied" when nothing was would be worse.
    }
  }

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {label}
        </Typography>
        <Typography
          sx={{ fontFamily: 'monospace', fontSize: '1.05rem', fontWeight: 600, wordBreak: 'break-all' }}
        >
          {value}
        </Typography>
      </Box>
      <Tooltip title={copied ? 'Copied' : `Copy ${label.toLowerCase()}`}>
        <IconButton size="small" onClick={() => void copy()} aria-label={`Copy ${label}`}>
          {copied ? (
            <CheckIcon fontSize="small" color="success" />
          ) : (
            <ContentCopyIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
    </Stack>
  )
}

interface CredentialsHandoffProps {
  username: string
  /**
   * `SchoolCreateResultDTO.requiresPasswordChange` /
   * `SchoolAdminCreateResultDTO.requiresPasswordChange`.
   *
   * True means no password was supplied, so the account holds the shared temporary
   * one and must change it at first login. False means the creator chose a password,
   * which the API never returns -- so there is nothing to show and nothing to copy.
   */
  requiresPasswordChange: boolean
  /** Shown alongside, when the credential belongs to a freshly created school. */
  schoolCode?: string
}

/**
 * The credentials of a newly created administrator.
 *
 * This component exists because of one API fact: the username is **generated**
 * (`CODE_ADMIN`, then `CODE_ADMIN2`, `CODE_ADMIN3`, ...) and returned only in the
 * creation response. It is never listed anywhere else in this module, and the account
 * holder cannot be told what it is by anyone but the person who ran the creation. So
 * this is a one-time handoff, and it has to look like one -- a success toast that
 * disappears after four seconds would strand the new admin.
 *
 * The password is only ever the shared constant, never a secret the server generated:
 * `Temp@123` is public knowledge in this codebase. The real security boundary is the
 * forced change at first login, which is why that is stated rather than implied.
 */
export function CredentialsHandoff({
  username,
  requiresPasswordChange,
  schoolCode,
}: CredentialsHandoffProps) {
  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
        <Stack spacing={1.5}>
          {schoolCode && <CopyRow label="School code" value={schoolCode} />}
          <CopyRow label="Username" value={username} />
          {requiresPasswordChange ? (
            <CopyRow label="Temporary password" value={TEMP_PASSWORD} />
          ) : (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Password
              </Typography>
              <Typography variant="body2" color="text.secondary">
                The one you set. The server never returns a password, so it cannot be
                shown here — if it has been lost, reset it from the Users screen.
              </Typography>
            </Box>
          )}
        </Stack>
      </Paper>

      {requiresPasswordChange ? (
        <Alert severity="warning">
          <AlertTitle>Hand these over now</AlertTitle>
          The username is generated and is not listed anywhere else — this is the only
          screen that shows it. The account must change its password at first login, so
          the temporary one stops working as soon as they do.
        </Alert>
      ) : (
        <Alert severity="info">
          <AlertTitle>Note the username</AlertTitle>
          It was generated from the school code and is not listed anywhere else, so it
          is worth recording before you close this.
        </Alert>
      )}
    </Stack>
  )
}
