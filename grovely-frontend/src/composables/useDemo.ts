// Demo feature dialog state. In the demo, genuinely server-only actions (real
// email, scheduled backups to S3/B2, manual export/restore) can't run because
// there is no server - that's the whole privacy guarantee. Instead of letting
// those buttons 404 or fake success, a `// DEMO GATE` at each entry point calls
// openDemoFeature(), which shows a dialog explaining what the feature does on a
// real instance and why the demo can't do it.
//
// Guards are written `if (__DEMO__) { openDemoFeature('key'); return }`, so in
// the normal build (`__DEMO__` === false) the branch is dead-code eliminated and
// this module tree-shakes away entirely - it never ships in the real app.
import { ref } from 'vue'

export interface DemoFeature {
  title: string
  body: string
}

const FEATURES: Record<string, DemoFeature> = {
  'test-email': {
    title: 'Email notifications',
    body: 'On your own Grovely this sends real email reminders - period predictions, expiry alerts, partner heads-ups - through your own SMTP server.',
  },
  'notification-edit': {
    title: 'Customise your notifications',
    body: 'On your own Grovely you can reword every notification - the greeting, the sign-off, the sender name, and each individual message - and your changes are saved to your instance.',
  },
  'scheduled-backups': {
    title: 'Automatic backups',
    body: 'On your own Grovely this takes scheduled snapshots of your data on a timer and can push them to local storage, an S3 bucket, or Backblaze B2, with retention limits and a full history you can restore from.',
  },
  'backup-export': {
    title: 'Export your data',
    body: 'On your own Grovely this downloads a complete snapshot of all your data, so you can keep your own copy or move between servers.',
  },
  'backup-restore': {
    title: 'Restore from a backup',
    body: 'On your own Grovely this loads a previously exported snapshot back into the app.',
  },
}

export const demoDialogOpen = ref(false)
export const demoFeature = ref<DemoFeature | null>(null)
export const demoExitDialogOpen = ref(false)

export function openDemoFeature(key: string): void {
  demoFeature.value = FEATURES[key] ?? {
    title: 'Available when you self-host',
    body: 'This action needs a running Grovely server, which the demo deliberately does not have.',
  }
  demoDialogOpen.value = true
}

export function openDemoExit(): void {
  demoExitDialogOpen.value = true
}
