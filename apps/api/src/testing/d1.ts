// A D1 database for tests, made of node:sqlite. It has the parts of the D1 API that the Worker uses: prepare, bind, first, all, run and batch.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

const MIGRATIONS = join(import.meta.dirname, '../../migrations');

/** An empty database with every migration applied. */
export function createTestDb(): D1Database {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(MIGRATIONS).sort()) sqlite.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  return new TestDb(sqlite) as unknown as D1Database;
}

interface Meta {
  changes: number;
}

class TestStatement {
  private readonly _sqlite: DatabaseSync;
  private readonly _sql: string;
  private _values: SQLInputValue[] = [];

  constructor(sqlite: DatabaseSync, sql: string) {
    this._sqlite = sqlite;
    this._sql = sql;
  }

  public bind(...values: SQLInputValue[]): this {
    this._values = values;
    return this;
  }

  public async first<T>(): Promise<T | null> {
    return (this._sqlite.prepare(this._sql).get(...this._values) as T | undefined) ?? null;
  }

  public async all<T>(): Promise<{ results: T[]; meta: Meta }> {
    return { results: this._sqlite.prepare(this._sql).all(...this._values) as T[], meta: { changes: 0 } };
  }

  public async run(): Promise<{ meta: Meta }> {
    const { changes } = this._sqlite.prepare(this._sql).run(...this._values);
    return { meta: { changes: Number(changes) } };
  }
}

class TestDb {
  private readonly _sqlite: DatabaseSync;
  /** D1 runs batches one after the other. One connection has one transaction, so the batches here wait in line. */
  private _line: Promise<unknown> = Promise.resolve();

  constructor(sqlite: DatabaseSync) {
    this._sqlite = sqlite;
  }

  public prepare(sql: string): TestStatement {
    return new TestStatement(this._sqlite, sql);
  }

  /** Runs the statements in order in one transaction, like D1 does. */
  public batch(statements: TestStatement[]): Promise<{ meta: Meta }[]> {
    const turn = this._line.then(() => this._runBatch(statements));
    this._line = turn.catch(() => undefined);
    return turn;
  }

  private async _runBatch(statements: TestStatement[]): Promise<{ meta: Meta }[]> {
    const results: { meta: Meta }[] = [];
    this._sqlite.exec('BEGIN');
    try {
      for (const statement of statements) results.push(await statement.run());
      this._sqlite.exec('COMMIT');
    } catch (error) {
      this._sqlite.exec('ROLLBACK');
      throw error;
    }
    return results;
  }
}
