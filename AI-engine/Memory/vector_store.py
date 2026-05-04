import chromadb
from chromadb.config import Settings
import logging
import os

logger = logging.getLogger(__name__)

class VectorStore:
    def __init__(self, db_path: str = "./memory/models/chroma_data"):
        os.makedirs(db_path, exist_ok=True)
        self.client = chromadb.PersistentClient(path=db_path)
        logger.info(f"Initialized ChromaDB at {db_path}")

    def get_collection_for_page(self, page_id: str):
        """
        Retrieves or creates a ChromaDB collection specific to a page.
        This optimizes RAM usage by only loading relevant contexts.
        """
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
        collection.add(
            documents=texts,
            metadatas=metadatas,
            ids=ids
        )
        logger.info(f"Added {len(texts)} chunks to page {page_id} context.")

    async def query_context(self, page_id: str, query_texts: list[str], n_results: int = 3):
        """
        Queries the page's vector collection for facts.
        """
        collection = self.get_collection_for_page(page_id)
        results = collection.query(
            query_texts=query_texts,
            n_results=n_results
        )
        return results

# Singleton instance
vector_store = VectorStore()
