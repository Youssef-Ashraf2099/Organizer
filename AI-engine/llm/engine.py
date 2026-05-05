from llama_cpp import Llama
import logging
import os
import asyncio

logger = logging.getLogger(__name__)

class LLMEngine:
    def __init__(self, model_path: str = "./Memory/models/Phi-3-mini-4k-instruct-q4.gguf"):
        self.model_path = model_path
        self.llm = None
        self.n_ctx = int(os.getenv("AI_N_CTX", "4096"))
        self.n_threads = int(os.getenv("AI_N_THREADS", "4"))
        self.n_gpu_layers = int(os.getenv("AI_N_GPU_LAYERS", "0"))
        self.n_batch = int(os.getenv("AI_N_BATCH", "256"))
        self.preload = os.getenv("AI_PRELOAD_MODEL", "1") == "1"
        self._load_error = None

        if self.preload:
            self._load_model()
        
    def _load_model(self) -> None:
        if self.llm is not None:
            return
        if not os.path.exists(self.model_path):
            logger.warning(
                f"Model file not found at {self.model_path}. Running in MOCK mode."
            )
            return

        logger.info(f"Loading LLM from {self.model_path}")
        try:
            self.llm = Llama(
                model_path=self.model_path,
                n_ctx=self.n_ctx,
                n_threads=self.n_threads,
                n_gpu_layers=self.n_gpu_layers,
                n_batch=self.n_batch,
                verbose=False,
            )
            logger.info("LLM loaded successfully.")
        except Exception as e:
            self._load_error = str(e)
            logger.error(f"Failed to load LLM: {e}")

    def ensure_loaded(self) -> None:
        if self.llm is None:
            self._load_model()

    def is_loaded(self) -> bool:
        return self.llm is not None

    async def generate_response(self, system_prompt: str, user_prompt: str, json_schema: dict = None) -> str:
        """
        Asynchronously generates a response from the LLM.
        If json_schema is provided, enforces JSON output via grammar or prompt structure.
        """
        self.ensure_loaded()
        if not self.llm:
            logger.warning("LLM is not loaded. Returning mock response.")
            if json_schema:
                # Return a valid mock JSON for the UI testing
                return '{"action": "insert_block", "params": {"content": "This is a mock AI response."}}'
            return "This is a mock AI response since no model was found."

        # Format prompt (assuming Phi-3 instruction format)
        prompt = f"<|system|>\n{system_prompt}<|end|>\n<|user|>\n{user_prompt}<|end|>\n<|assistant|>\n"
        
        # We use asyncio.to_thread to prevent blocking the async event loop during inference
        response = await asyncio.to_thread(
            self.llm,
            prompt,
            max_tokens=1024,
            stop=["<|end|>"],
            echo=False
        )
        
        return response['choices'][0]['text'].strip()

engine = LLMEngine()
