import logging
import os
import shutil
from typing import Any

try:
    import chromadb
    from chromadb.config import Settings
    _HAS_CHROMA = True
except Exception as exc:
    chromadb = None
    Settings = None
    _HAS_CHROMA = False
    _CHROMA_IMPORT_ERROR = exc

logger = logging.getLogger(__name__)

class VectorStore:
    def __init__(self, db_path: str = "./memory/models/chroma_data"):
        self.client: Any = None
        self._memory_store: dict[str, list[dict]] = {}

        auto_reset = os.getenv("AI_RESET_CHROMA_ON_MIGRATION", "0") == "1"

        if _HAS_CHROMA:
            os.makedirs(db_path, exist_ok=True)
            try:
                self.client = chromadb.PersistentClient(path=db_path)
                logger.info(f"Initialized ChromaDB at {db_path}")
            except Exception as exc:
                msg = str(exc).lower()
                if auto_reset and "migration" in msg:
                    logger.warning(
                        "ChromaDB migration mismatch detected; resetting %s",
                        db_path,
                    )
                    shutil.rmtree(db_path, ignore_errors=True)
                    os.makedirs(db_path, exist_ok=True)
                    self.client = chromadb.PersistentClient(path=db_path)
                    logger.info("ChromaDB reset completed.")
                else:
                    logger.error(
                        "ChromaDB init failed; running in no-op mode. %s",
                        exc,
                    )
                    self.client = None
        else:
            logger.warning(
                "ChromaDB is not installed; vector store is running in no-op mode. %s",
                _CHROMA_IMPORT_ERROR,
            )

    def get_collection_for_page(self, page_id: str):
        """
        Retrieves or creates a ChromaDB collection specific to a page.
        This optimizes RAM usage by only loading relevant contexts.
        """
        if not self.client:
            return None
        # Ensure collection names adhere to Chroma constraints
        safe_page_id = page_id.replace("-", "_") 
        try:
            return self.client.get_or_create_collection(name=f"page_{safe_page_id}")
        except Exception as e:
            logger.error(f"Error getting collection for page {page_id}: {e}")
            raise

    async def add_context(self, page_id: str, texts: list[str], metadatas: list[dict], ids: list[str]):
        """
        Adds text chunks to the page's vector collection.
        """
        collection = self.get_collection_for_page(page_id)
        if not collection:
            self._memory_store.setdefault(page_id, []).extend(
                {
                    "text": text,
                    "metadata": metadata,
                    "id": doc_id,
                }
                for text, metadata, doc_id in zip(texts, metadatas, ids)
            )
            logger.info(
                f"Stored {len(texts)} chunks in in-memory context for page {page_id}"
            )
            return

        collection.add(documents=texts, metadatas=metadatas, ids=ids)
        logger.info(f"Added {len(texts)} chunks to page {page_id} context.")

    async def query_context(self, page_id: str, query_texts: list[str], n_results: int = 3):
        """
        Queries the page's vector collection for facts.
        """
        collection = self.get_collection_for_page(page_id)
        if not collection:
            stored = self._memory_store.get(page_id, [])
            return {
                "documents": [[item["text"] for item in stored[:n_results]]],
                "metadatas": [[item["metadata"] for item in stored[:n_results]]],
                "ids": [[item["id"] for item in stored[:n_results]]],
            }

        results = collection.query(query_texts=query_texts, n_results=n_results)
        return results

# Singleton instance
vector_store = VectorStore()
