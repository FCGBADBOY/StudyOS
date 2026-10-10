/**
 * Admin → Settings.
 *
 * Every control on this page is backed by a real row in `platform_settings`
 * (or, for notifications, a per-device preference) — there are no decorative
 * switches that pretend to do something. Each group saves independently so a
 * rejected value never discards edits made in another card.
 *
 * What is deliberately *not* here: roles and permissions. Those live in
 * PostgreSQL (`role_permissions` + RLS) because a setting a browser can edit
 * is not a security control. This page shows the read-only matrix instead, so
 * an admin can see what each role is granted without being able to change it
 * from a UI.
 */
import { useEffect, useState } from 'react'
import { KeyRound, Save, ShieldCheck } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from '@/components/ui'
import { useToast } from '@/context/AppProvider'
import { Notice } from '../components/AdminFeedback'
import { useAdminSession } from '../hooks/useAdminSession'
import { can, permissionsFor } from '../lib/permissions'
import {
  DEFAULT_SETTINGS,
  getNotificationPrefs,
  getSettings,
  saveNotificationPrefs,
  saveSettings,
  type AdminNotificationPrefs,
  type AdminSettings,
} from '../services/adminSettings.service'
import { ADMIN_ROLES, ROLE_LABELS } from '../types/admin'

const FILE_TYPES = [
  { id: 'pdf', label: 'PDF documents' },
  { id: 'png', label: 'PNG images' },
  { id: 'jpg', label: 'JPEG images' },
  { id: 'jpeg', label: 'JPEG (alternate)' },
  { id: 'webp', label: 'WebP images' },
]

const DEFAULT_STATUS_OPTIONS = [
  { id: 'draft', label: 'Draft — stay invisible until published' },
  { id: 'pending_review', label: 'Pending review — enter the moderation queue' },
  { id: 'published', label: 'Published — go live immediately' },
]

export default function AdminSettingsPage() {
  const { toast } = useToast()
  const { role, loading: sessionLoading } = useAdminSession()

  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS)
  const [prefs, setPrefs] = useState<AdminNotificationPrefs>(getNotificationPrefs())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingGroup, setSavingGroup] = useState<string | null>(null)

  const mayManage = can(role, 'settings.manage')

  useEffect(() => {
    let cancelled = false
    getSettings()
      .then((value) => {
        if (!cancelled) setSettings(value)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'We could not load the settings.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function persist<K extends keyof AdminSettings>(key: K, value: AdminSettings[K], label: string) {
    setSavingGroup(key)
    try {
      await saveSettings(key, value)
      setSettings((current) => ({ ...current, [key]: value }))
      toast({ title: `${label} saved`, variant: 'success' })
    } catch (caught) {
      toast({
        title: 'Could not save that setting',
        description: caught instanceof Error ? caught.message : undefined,
        variant: 'danger',
      })
    } finally {
      setSavingGroup(null)
    }
  }

  if (sessionLoading || loading) {
    return (
      <div className="py-10">
        <LoadingState label="Loading settings…" />
      </div>
    )
  }

  if (error) {
    return <ErrorState title="We could not load the settings." description={error} onRetry={() => window.location.reload()} />
  }

  if (!mayManage) {
    return (
      <Notice tone="warning" title="You don't have permission to change platform settings.">
        Ask a super admin to grant <code className="font-mono text-xs">settings.manage</code> if you
        believe this is a mistake.
      </Notice>
    )
  }

  const readOnly = !mayManage

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        subtitle="Platform-wide defaults for uploads, the content workflow and student access."
      />

      {/* --------------------------------------------------------- uploads */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-foreground">Uploads</h2>
        <p className="mt-1 text-sm text-muted">
          Applies to resource files. Anything larger, or of another type, is rejected before it
          leaves the browser — and again by storage policy.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Maximum file size (MB)"
            type="number"
            min={1}
            max={500}
            value={String(settings.upload.max_file_mb)}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                upload: { ...current.upload, max_file_mb: Number(event.target.value) },
              }))
            }
            hint="Between 1 and 500 MB."
            disabled={readOnly}
          />

          <div>
            <p className="mb-1.5 text-[13px] font-medium text-muted">Allowed file types</p>
            <div className="space-y-2">
              {FILE_TYPES.map((type) => {
                const checked = settings.upload.allowed_types.includes(type.id)
                return (
                  <Checkbox
                    key={type.id}
                    checked={checked}
                    disabled={readOnly}
                    onChange={(next) =>
                      setSettings((current) => ({
                        ...current,
                        upload: {
                          ...current.upload,
                          allowed_types: next
                            ? [...current.upload.allowed_types, type.id]
                            : current.upload.allowed_types.filter((value) => value !== type.id),
                        },
                      }))
                    }
                    label={type.label}
                  />
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Button
            loading={savingGroup === 'upload'}
            onClick={() => void persist('upload', settings.upload, 'Upload rules')}
            icon={<Save className="size-4" aria-hidden="true" />}
          >
            Save uploads
          </Button>
        </div>
      </Card>

      {/* -------------------------------------------------------- workflow */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-foreground">Content workflow</h2>
        <p className="mt-1 text-sm text-muted">
          New resources start here, and whether an editor may publish their own work.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Default status for new resources"
            value={settings.content.default_status}
            onChange={(value) =>
              setSettings((current) => ({
                ...current,
                content: { ...current.content, default_status: value as AdminSettings['content']['default_status'] },
              }))
            }
            options={DEFAULT_STATUS_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
            id="default-status"
          />

          <div className="flex items-end">
            <Checkbox
              checked={settings.content.require_review}
              disabled={readOnly}
              onChange={(next) =>
                setSettings((current) => ({
                  ...current,
                  content: { ...current.content, require_review: next },
                }))
              }
              label="Editors must submit for review"
              description="When on, content_editor accounts cannot publish — a moderator or admin has to approve first."
            />
          </div>
        </div>

        <div className="mt-4">
          <Button
            loading={savingGroup === 'content'}
            onClick={() => void persist('content', settings.content, 'Workflow')}
            icon={<Save className="size-4" aria-hidden="true" />}
          >
            Save workflow
          </Button>
        </div>
      </Card>

      {/* --------------------------------------------------------- platform */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-foreground">Platform</h2>
        <p className="mt-1 text-sm text-muted">Who may join, and where reports are forwarded.</p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Checkbox
            checked={settings.platform.student_signups}
            disabled={readOnly}
            onChange={(next) =>
              setSettings((current) => ({
                ...current,
                platform: { ...current.platform, student_signups: next },
              }))
            }
            label="Allow new student sign-ups"
            description="Turning this off keeps existing students signed in but blocks registration."
          />

          <Input
            label="Report forwarding email"
            type="email"
            value={settings.platform.report_email}
            placeholder="content@example.com"
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                platform: { ...current.platform, report_email: event.target.value },
              }))
            }
            hint="Optional. Leave empty to keep reports inside the portal."
            disabled={readOnly}
          />
        </div>

        <div className="mt-4">
          <Button
            loading={savingGroup === 'platform'}
            onClick={() => void persist('platform', settings.platform, 'Platform settings')}
            icon={<Save className="size-4" aria-hidden="true" />}
          >
            Save platform
          </Button>
        </div>
      </Card>

      {/* --------------------------------------------------- notifications */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-foreground">Your notifications</h2>
        <p className="mt-1 text-sm text-muted">Stored on this device — they do not affect other admins.</p>

        <div className="mt-4 space-y-3">
          <Checkbox
            checked={prefs.newSubmissions}
            onChange={(next) => setPrefs((current) => ({ ...current, newSubmissions: next }))}
            label="New submissions"
            description="When an editor submits content for review."
          />
          <Checkbox
            checked={prefs.openReports}
            onChange={(next) => setPrefs((current) => ({ ...current, openReports: next }))}
            label="Open reports"
            description="When a student files a report that needs moderation."
          />
          <Checkbox
            checked={prefs.weeklyDigest}
            onChange={(next) => setPrefs((current) => ({ ...current, weeklyDigest: next }))}
            label="Weekly digest"
            description="A Monday summary of publishing, reports and growth."
          />
        </div>

        <div className="mt-4">
          <Button
            onClick={() => {
              saveNotificationPrefs(prefs)
              toast({ title: 'Notification preferences saved', variant: 'success' })
            }}
            icon={<Save className="size-4" aria-hidden="true" />}
          >
            Save notifications
          </Button>
        </div>
      </Card>

      {/* ---------------------------------------------- permissions (read) */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <KeyRound className="size-4 text-brand" aria-hidden="true" />
          Role permissions
        </h2>
        <p className="mt-1 text-sm text-muted">
          Read-only here by design. The authoritative matrix lives in PostgreSQL and is enforced by
          Row Level Security, so it cannot be edited from a browser.
        </p>

        <div className="mt-4 overflow-x-auto no-scrollbar">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="sr-only">Permissions granted to each administrative role</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="py-2 pr-4 font-medium text-muted">Permission</th>
                {ADMIN_ROLES.map((value) => (
                  <th key={value} scope="col" className="py-2 pr-4 font-medium text-muted">
                    {ROLE_LABELS[value] ?? value}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissionsFor('admin').map((permission) => (
                <tr key={permission} className="border-b border-border/60">
                  <th scope="row" className="py-2 pr-4 text-left font-mono text-xs font-normal text-foreground">
                    {permission}
                  </th>
                  {ADMIN_ROLES.map((value) => (
                    <td key={value} className="py-2 pr-4">
                      {permissionsFor(value).includes(permission) ? (
                        <ShieldCheck className="size-4 text-success" aria-label="Granted" />
                      ) : (
                        <span className="text-xs text-faint" aria-label="Not granted">
                          —
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <code className="font-mono text-[11px]">role_permissions</code>
          </Badge>
          <Badge variant="outline">
            <code className="font-mono text-[11px]">has_permission()</code>
          </Badge>
          <Badge variant="outline">
            <code className="font-mono text-[11px]">guard_profile_role()</code>
          </Badge>
        </div>
      </Card>
    </div>
  )
}
