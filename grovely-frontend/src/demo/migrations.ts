// Loads the real backend migration files (.sql) at build time and applies them
// to the in-memory database, in filename order. Using the actual migrations -
// not a hand-copied schema - means the demo's schema can never drift from the
// app. The glob is eager+raw so the SQL text is inlined into the demo chunk.

import type { DemoDatabase } from './db-shim'

const migrationModules = import.meta.glob('../../../grovely-backend/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export function runMigrations(db: DemoDatabase): void {
  const files = Object.keys(migrationModules).sort()
  for (const file of files) {
    const sql = migrationModules[file]
    try {
      db.exec(sql)
    } catch (err) {
      // Surface which migration failed; in-memory SQLite differences would show
      // up here rather than silently producing a broken schema.
      console.error(`[demo] migration failed: ${file}`, err)
      throw err
    }
  }
}
