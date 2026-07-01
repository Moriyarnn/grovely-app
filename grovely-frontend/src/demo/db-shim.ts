// better-sqlite3 API, implemented on top of sql.js (WASM SQLite, in memory).
//
// The real backend route files call db.prepare(sql).get/all/run(...) and
// db.transaction(fn) - the synchronous better-sqlite3 surface. sql.js is also
// synchronous once its WASM has loaded, so we can present the exact same shape
// here and run those route files verbatim in the browser. This is the single
// adapter that makes "run the real backend in the tab" possible.

import type { Database as SqlJsDatabase, Statement as SqlJsStatement } from 'sql.js'

type Row = Record<string, unknown>

// better-sqlite3 accepts either spread positional args (`.get(a, b)`), a single
// array (`.all([a, b])`), or a single object for named params. sql.js `bind`
// understands an array or an object, so we normalise to one of those.
function normalizeParams(params: unknown[]): unknown[] | Record<string, unknown> {
  if (params.length === 1 && (Array.isArray(params[0]) || isPlainObject(params[0]))) {
    return params[0] as unknown[] | Record<string, unknown>
  }
  return params
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

class PreparedStatement {
  constructor(private db: SqlJsDatabase, private sql: string) {}

  private withStmt<T>(params: unknown[], fn: (s: SqlJsStatement) => T): T {
    const stmt = this.db.prepare(this.sql)
    try {
      const bound = normalizeParams(params)
      // sql.js bind() rejects an empty array on a no-param statement in some
      // builds; only bind when there is something to bind.
      if (Array.isArray(bound) ? bound.length > 0 : Object.keys(bound).length > 0) {
        stmt.bind(bound as never)
      }
      return fn(stmt)
    } finally {
      stmt.free()
    }
  }

  get(...params: unknown[]): Row | undefined {
    return this.withStmt(params, (s) => (s.step() ? (s.getAsObject() as Row) : undefined))
  }

  all(...params: unknown[]): Row[] {
    return this.withStmt(params, (s) => {
      const rows: Row[] = []
      while (s.step()) rows.push(s.getAsObject() as Row)
      return rows
    })
  }

  run(...params: unknown[]): { changes: number; lastInsertRowid: number } {
    this.db.run(this.sql, normalizeParams(params) as never)
    const changes = this.db.getRowsModified()
    const res = this.db.exec('SELECT last_insert_rowid() AS id')
    const lastInsertRowid = res.length ? Number(res[0].values[0][0]) : 0
    return { changes, lastInsertRowid }
  }
}

export class DemoDatabase {
  constructor(public raw: SqlJsDatabase) {}

  prepare(sql: string): PreparedStatement {
    return new PreparedStatement(this.raw, sql)
  }

  // Runs one or more statements (used for migrations).
  exec(sql: string): this {
    this.raw.run(sql)
    return this
  }

  // better-sqlite3 returns a callable that runs `fn` inside a transaction.
  transaction<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
    return (...args: A): R => {
      this.raw.run('BEGIN')
      try {
        const out = fn(...args)
        this.raw.run('COMMIT')
        return out
      } catch (err) {
        try { this.raw.run('ROLLBACK') } catch { /* ignore */ }
        throw err
      }
    }
  }

  pragma(statement: string): void {
    this.raw.run('PRAGMA ' + statement)
  }

  close(): void {
    this.raw.close()
  }
}
