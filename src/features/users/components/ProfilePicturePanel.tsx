import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined'
import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useRef, useState } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { getErrorMessage } from '@/lib/serverErrors'
import { toastError, toastSuccess } from '@/ui/uiSlice'
import {
  useDeleteProfilePictureMutation,
  useGetProfilePictureQuery,
  useUploadProfilePictureMutation,
} from '../usersApi'

/**
 * The same three rules the controller enforces, so a photo that will be refused is refused
 * before it costs an upload. `image/jpg` is in the server's list as well -- it is not a real
 * MIME type, but a browser that sends it would otherwise be rejected.
 */
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
const MAX_BYTES = 5 * 1024 * 1024

function initialsOf(firstName: string, lastName: string, username: string): string {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.trim()
  return (initials || username.charAt(0)).toUpperCase()
}

interface ProfilePicturePanelProps {
  userId: number
  firstName: string
  lastName: string
  username: string
  /**
   * From the list or details row. Used to skip the fetch entirely when there is nothing to
   * fetch -- the endpoint answers 404 for a user who has never uploaded one, and a 404 per
   * page load for most of a school is noise.
   */
  hasProfilePicture: boolean
  /** False for a viewer who is neither an admin nor this user; hides both buttons. */
  canEdit: boolean
}

/**
 * The profile picture, with its upload and delete.
 *
 * The image is **fetched**, not pointed at: `GET /users/{id}/profile-picture` needs the bearer
 * token and an `<img src>` cannot carry one. `usersApi` turns the blob into an object URL and
 * revokes it when the cache entry goes.
 *
 * All three endpoints live on `Users` but are gated by `CanAccessUser` rather than the
 * permission grid -- except the read, which has no check at all and so is readable by any
 * signed-in user in the school. Nothing here relies on that; `canEdit` is the caller's
 * decision and mirrors the write endpoints' rule.
 */
export function ProfilePicturePanel({
  userId,
  firstName,
  lastName,
  username,
  hasProfilePicture,
  canEdit,
}: ProfilePicturePanelProps) {
  const dispatch = useAppDispatch()
  const fileInput = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: pictureUrl, isFetching } = useGetProfilePictureQuery(userId, {
    skip: !hasProfilePicture,
  })

  const [upload, { isLoading: uploading }] = useUploadProfilePictureMutation()
  const [remove, { isLoading: removing }] = useDeleteProfilePictureMutation()

  const handleFile = async (file: File | undefined) => {
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      dispatch(toastError('Only JPEG, PNG and GIF images are accepted.'))
      return
    }
    if (file.size > MAX_BYTES) {
      dispatch(toastError('That image is over 5 MB. Choose a smaller one.'))
      return
    }

    try {
      await upload({ userId, file }).unwrap()
      dispatch(toastSuccess('Profile picture updated.'))
    } catch (error) {
      dispatch(toastError(getErrorMessage(error, 'Could not upload the picture.')))
    }
  }

  const handleDelete = async () => {
    try {
      await remove(userId).unwrap()
      dispatch(toastSuccess('Profile picture removed.'))
      setConfirmDelete(false)
    } catch (error) {
      dispatch(toastError(getErrorMessage(error, 'Could not remove the picture.')))
      setConfirmDelete(false)
    }
  }

  const busy = uploading || removing

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
        Profile picture
      </Typography>

      <Stack spacing={2} sx={{ alignItems: 'center' }}>
        {isFetching ? (
          <Skeleton variant="circular" width={112} height={112} />
        ) : (
          <Avatar
            src={pictureUrl}
            alt={`${firstName} ${lastName}`.trim() || username}
            sx={{ width: 112, height: 112, fontSize: 40 }}
          >
            {initialsOf(firstName, lastName, username)}
          </Avatar>
        )}

        {hasProfilePicture && !isFetching && !pictureUrl && (
          <Alert severity="info" sx={{ width: '100%' }}>
            The record says there is a picture but it could not be read. Uploading a new one
            replaces whatever is stored.
          </Alert>
        )}

        {canEdit && (
          <>
            {/* Hidden input rather than a styled file field: MUI has no file input, and a
                Button that forwards its click is both accessible and consistent with the
                rest of the app's buttons. */}
            <input
              ref={fileInput}
              type="file"
              accept={ALLOWED_TYPES.join(',')}
              hidden
              onChange={(event) => {
                void handleFile(event.target.files?.[0])
                // Cleared so choosing the same file twice still fires a change.
                event.target.value = ''
              }}
            />

            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PhotoCameraOutlinedIcon />}
                loading={uploading}
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                {hasProfilePicture ? 'Replace' : 'Upload'}
              </Button>

              {hasProfilePicture && (
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteOutlineIcon />}
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  Remove
                </Button>
              )}
            </Stack>

            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              JPEG, PNG or GIF, up to 5 MB. The image is stored in the database against the
              person, not on disk, so it follows the record everywhere it appears.
            </Typography>
          </>
        )}
      </Stack>

      <ConfirmDialog
        open={confirmDelete}
        title="Remove this picture?"
        destructive
        busy={removing}
        confirmLabel="Remove"
        message="The stored image is cleared and the account falls back to its initials. Nothing else about the account changes, and a new picture can be uploaded at any time."
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </Paper>
  )
}
