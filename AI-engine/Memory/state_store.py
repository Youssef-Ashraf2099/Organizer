import sqlite3
import json
import logging
from Memory.migrations import run_migrations

logger = logging.getLogger(__name__)

class StateStore:
    def __init__(self, db_path: str = "./memory/models/ai_state.db"):
        self.db_path = db_path
        run_migrations(db_path)
        logger.info(f"Initialized StateStore at {db_path}")

    def get_connection(self):
        return sqlite3.connect(self.db_path)

    def save_agent_state(self, state_id: str, page_id: str, state_data: dict):
        conn = self.get_connection()
        cursor = conn.cursor()
        data_str = json.dumps(state_data)
        cursor.execute("""
            INSERT INTO agent_states (id, page_id, state_data, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                state_data=excluded.state_data,
                updated_at=CURRENT_TIMESTAMP
        """, (state_id, page_id, data_str))
        conn.commit()
        conn.close()

    def load_agent_state(self, state_id: str) -> dict:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT state_data FROM agent_states WHERE id = ?", (state_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return json.loads(row[0])
        return {}

state_store = StateStore()
