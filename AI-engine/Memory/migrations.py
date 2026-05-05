import sqlite3
import logging
import os

logger = logging.getLogger(__name__)

MIGRATIONS = [
    """
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS agent_states (
        id TEXT PRIMARY KEY,
        page_id TEXT NOT NULL,
        state_data TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS chat_threads (
        id TEXT PRIMARY KEY,
        page_id TEXT NOT NULL,
        title TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (thread_id) REFERENCES chat_threads (id) ON DELETE CASCADE
    );
    """
]

def run_migrations(db_path: str):
    """
    Runs all pending migrations on the local SQLite DB.
    """
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check current version
    try:
        cursor.execute("SELECT MAX(version) FROM schema_migrations")
        row = cursor.fetchone()
        current_version = row[0] if row[0] is not None else 0
    except sqlite3.OperationalError:
        current_version = 0

    # Run new migrations
    for i in range(current_version, len(MIGRATIONS)):
        logger.info(f"Running migration {i + 1}...")
        try:
            cursor.execute(MIGRATIONS[i])
            cursor.execute("INSERT INTO schema_migrations (version) VALUES (?)", (i + 1,))
            conn.commit()
            logger.info(f"Migration {i + 1} applied successfully.")
        except Exception as e:
            logger.error(f"Migration {i + 1} failed: {e}")
            conn.rollback()
            raise e

    conn.close()
