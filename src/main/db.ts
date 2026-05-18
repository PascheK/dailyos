import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'

const DB_PATH = path.join(app.getPath('userData'), 'dailyos.db')
export const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── Schéma initial (v1) ──────────────────────────────────────────────────────
// Crée les tables si elles n'existent pas encore (première installation)
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT DEFAULT '',
    start_at    TEXT NOT NULL,
    end_at      TEXT NOT NULL,
    all_day     INTEGER DEFAULT 0,
    category    TEXT DEFAULT 'default',
    color       TEXT DEFAULT '#1A56DB',
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS files (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    path        TEXT NOT NULL UNIQUE,
    size        INTEGER DEFAULT 0,
    mime_type   TEXT DEFAULT '',
    folder      TEXT DEFAULT 'Tous les fichiers',
    created_at  TEXT DEFAULT (datetime('now'))
  );
`)

// ── Migrations ───────────────────────────────────────────────────────────────
// user_version est un entier stocké dans le fichier .db lui-même.
// On l'incrémente à chaque changement de schéma pour savoir quoi migrer.
const version = db.pragma('user_version', { simple: true }) as number
console.log('[DB] Version actuelle :', version)

if (version < 2) {
  // Migration v1 → v2 :
  //   - Création de la table `folders` (dossiers indépendants)
  //   - Remplacement de la colonne `folder` (TEXT) par `folder_id` (FK)
  console.log('[DB] Migration v2 : ajout de la table folders...')

  db.transaction(() => {
    // 1. Créer la table folders
    db.exec(`
      CREATE TABLE IF NOT EXISTS folders (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL UNIQUE,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `)

    // 2. Lire les dossiers existants dans les fichiers (si la table existe déjà)
    const cols = db.prepare('PRAGMA table_info(files)').all() as { name: string }[]
    const hasOldFolder = cols.some((c) => c.name === 'folder')
    const hasNewFolder = cols.some((c) => c.name === 'folder_id')

    if (hasOldFolder && !hasNewFolder) {
      // 2a. Récupérer les noms de dossiers distincts et les insérer dans folders
      const oldFolders = db
        .prepare("SELECT DISTINCT folder FROM files WHERE folder != 'Tous les fichiers'")
        .all() as { folder: string }[]

      const insertFolder = db.prepare('INSERT OR IGNORE INTO folders (name) VALUES (?)')
      for (const { folder } of oldFolders) {
        insertFolder.run(folder)
      }

      // 2b. Créer la nouvelle table files avec folder_id
      db.exec(`
        CREATE TABLE files_v2 (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          name        TEXT NOT NULL,
          path        TEXT NOT NULL UNIQUE,
          size        INTEGER DEFAULT 0,
          mime_type   TEXT DEFAULT '',
          folder_id   INTEGER REFERENCES folders(id) ON DELETE SET NULL,
          created_at  TEXT DEFAULT (datetime('now'))
        );
      `)

      // 2c. Copier les données (JOIN sur le nom du dossier pour récupérer l'id)
      db.exec(`
        INSERT INTO files_v2 (id, name, path, size, mime_type, folder_id, created_at)
        SELECT f.id, f.name, f.path, f.size, f.mime_type, fo.id, f.created_at
        FROM files f
        LEFT JOIN folders fo ON f.folder = fo.name
      `)

      // 2d. Remplacer l'ancienne table
      db.exec('DROP TABLE files')
      db.exec('ALTER TABLE files_v2 RENAME TO files')

    } else if (!hasOldFolder && !hasNewFolder) {
      // Installation fraîche : créer directement la bonne structure
      db.exec(`
        CREATE TABLE IF NOT EXISTS files (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          name        TEXT NOT NULL,
          path        TEXT NOT NULL UNIQUE,
          size        INTEGER DEFAULT 0,
          mime_type   TEXT DEFAULT '',
          folder_id   INTEGER REFERENCES folders(id) ON DELETE SET NULL,
          created_at  TEXT DEFAULT (datetime('now'))
        );
      `)
    }

    // 3. Marquer la migration comme effectuée
    db.pragma('user_version = 2')
  })()

  console.log('[DB] Migration v2 terminée.')
}

if (version < 3) {
  // Migration v2 → v3 : ajout de la table whiteboards
  console.log('[DB] Migration v3 : ajout de la table whiteboards...')

  db.exec(`
    CREATE TABLE IF NOT EXISTS whiteboards (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL DEFAULT 'Sans titre',
      data       TEXT NOT NULL DEFAULT '{}',
      color      TEXT NOT NULL DEFAULT '#6d5fff',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `)

  db.pragma('user_version = 3')
  console.log('[DB] Migration v3 terminée.')
}

if (version < 4) {
  // Migration v3 → v4 : table messages (historique des conversations IA)
  console.log('[DB] Migration v4 : ajout de la table messages...')
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      role       TEXT NOT NULL,     -- 'user' | 'assistant'
      content    TEXT NOT NULL,
      provider   TEXT DEFAULT '',   -- 'openai' | 'anthropic' | 'ollama'
      model      TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)
  db.pragma('user_version = 4')
  console.log('[DB] Migration v4 terminée.')
}

if (version < 5) {
  // Migration v4 → v5 : système multi-conversations
  console.log('[DB] Migration v5 : système de conversations IA...')
  db.transaction(() => {
    // 1. Table des conversations
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        title      TEXT NOT NULL DEFAULT 'Nouvelle conversation',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `)

    // 2. Ajouter conversation_id à messages (si la table existe déjà avec des données)
    const msgCols = db.prepare('PRAGMA table_info(messages)').all() as { name: string }[]
    const hasConvId = msgCols.some(c => c.name === 'conversation_id')

    if (!hasConvId && msgCols.length > 0) {
      // Il existe déjà des messages → créer une conversation "legacy" pour les accueillir
      const count = (db.prepare('SELECT COUNT(*) as c FROM messages').get() as { c: number }).c
      if (count > 0) {
        db.exec(`INSERT INTO conversations (title) VALUES ('Historique')`)
        const legacyId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id
        db.exec(`ALTER TABLE messages ADD COLUMN conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE`)
        db.prepare('UPDATE messages SET conversation_id = ?').run(legacyId)
      } else {
        db.exec(`ALTER TABLE messages ADD COLUMN conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE`)
      }
    } else if (msgCols.length === 0) {
      // Table messages n'existe pas encore (installation fraîche)
      db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          role            TEXT NOT NULL,
          content         TEXT NOT NULL,
          provider        TEXT DEFAULT '',
          model           TEXT DEFAULT '',
          conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
          created_at      TEXT DEFAULT (datetime('now'))
        );
      `)
    }

    db.pragma('user_version = 5')
  })()
  console.log('[DB] Migration v5 terminée.')
}

if (version < 6) {
  // Migration v5 → v6 : gestionnaire de budget
  console.log('[DB] Migration v6 : tables budget...')
  db.transaction(() => {
    db.exec(`
      -- Budgets principaux
      CREATE TABLE IF NOT EXISTS budgets (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        name                    TEXT NOT NULL,
        total_amount            REAL NOT NULL,
        currency                TEXT NOT NULL DEFAULT 'CHF',
        display_currency        TEXT,
        display_rate            REAL,
        display_rate_updated_at TEXT,
        start_date              TEXT NOT NULL,
        end_date                TEXT NOT NULL,
        created_at              TEXT DEFAULT (datetime('now'))
      );

      -- Dépenses hors-budget (non comptées mensuellement)
      CREATE TABLE IF NOT EXISTS budget_extra_items (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        budget_id    INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
        label        TEXT NOT NULL,
        amount       REAL NOT NULL,
        planned_date TEXT,
        created_at   TEXT DEFAULT (datetime('now'))
      );

      -- Catégories (budget_id NULL = catégorie globale prédéfinie)
      CREATE TABLE IF NOT EXISTS budget_categories (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        budget_id INTEGER REFERENCES budgets(id) ON DELETE CASCADE,
        name      TEXT NOT NULL,
        color     TEXT NOT NULL DEFAULT '#6985B5',
        icon      TEXT NOT NULL DEFAULT '💳'
      );

      -- Transactions (dépenses & revenus)
      CREATE TABLE IF NOT EXISTS budget_transactions (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        budget_id    INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
        category_id  INTEGER REFERENCES budget_categories(id) ON DELETE SET NULL,
        label        TEXT NOT NULL,
        amount       REAL NOT NULL,
        currency     TEXT NOT NULL,
        amount_base  REAL NOT NULL,
        date         TEXT NOT NULL,
        is_revenue   INTEGER NOT NULL DEFAULT 0,
        is_recurring INTEGER NOT NULL DEFAULT 0,
        recurring_id INTEGER REFERENCES budget_recurring(id) ON DELETE SET NULL,
        created_at   TEXT DEFAULT (datetime('now'))
      );

      -- Modèles de transactions récurrentes
      CREATE TABLE IF NOT EXISTS budget_recurring (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        budget_id        INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
        category_id      INTEGER REFERENCES budget_categories(id) ON DELETE SET NULL,
        label            TEXT NOT NULL,
        amount           REAL NOT NULL,
        currency         TEXT NOT NULL,
        recurrence_type  TEXT NOT NULL DEFAULT 'monthly',
        recurrence_day   INTEGER NOT NULL DEFAULT 1,
        active           INTEGER NOT NULL DEFAULT 1,
        last_applied     TEXT
      );

      -- Objectifs IA par période
      CREATE TABLE IF NOT EXISTS budget_ai_goals (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        budget_id           INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
        period_start        TEXT NOT NULL,
        period_end          TEXT NOT NULL,
        monthly_target      REAL NOT NULL,
        critical_threshold  REAL NOT NULL,
        recalculated_at     TEXT DEFAULT (datetime('now'))
      );
    `)

    // Catégories globales prédéfinies
    const existingCats = db.prepare(
      'SELECT COUNT(*) as c FROM budget_categories WHERE budget_id IS NULL'
    ).get() as { c: number }

    if (existingCats.c === 0) {
      const cats = [
        { name: 'Logement',     color: '#6985B5', icon: '🏠' },
        { name: 'Nourriture',   color: '#22a84e', icon: '🍜' },
        { name: 'Transport',    color: '#f59e0b', icon: '🚆' },
        { name: 'Loisirs',      color: '#a855f7', icon: '🎮' },
        { name: 'Santé',        color: '#ef4444', icon: '💊' },
        { name: 'Shopping',     color: '#ec4899', icon: '🛍️' },
        { name: 'Voyages',      color: '#0891b2', icon: '✈️' },
        { name: 'Abonnements',  color: '#64748b', icon: '📱' },
        { name: 'Autre',        color: '#78716c', icon: '💳' },
      ]
      const ins = db.prepare(
        'INSERT INTO budget_categories (budget_id, name, color, icon) VALUES (NULL, ?, ?, ?)'
      )
      for (const c of cats) ins.run(c.name, c.color, c.icon)
    }

    db.pragma('user_version = 6')
  })()
  console.log('[DB] Migration v6 terminée.')
}

if (version < 7) {
  // Migration v6 → v7 : limites de budget par catégorie
  console.log('[DB] Migration v7 : table budget_category_limits...')
  db.exec(`
    CREATE TABLE IF NOT EXISTS budget_category_limits (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      budget_id     INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
      category_id   INTEGER NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
      monthly_limit REAL NOT NULL,
      UNIQUE(budget_id, category_id)
    );
  `)
  db.pragma('user_version = 7')
  console.log('[DB] Migration v7 terminée.')
}

if (version < 8) {
  // Migration v7 → v8 : couleur et ordre de tri sur les dossiers
  console.log('[DB] Migration v8 : couleur et ordre des dossiers...')
  db.exec(`ALTER TABLE folders ADD COLUMN color TEXT DEFAULT NULL`)
  db.exec(`ALTER TABLE folders ADD COLUMN sort_order INTEGER DEFAULT 0`)
  db.pragma('user_version = 8')
  console.log('[DB] Migration v8 terminée.')
}

console.log('[DB] Initialisée :', DB_PATH)
