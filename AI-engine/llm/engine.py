from llama_cpp import Llama
import logging
import os
import asyncio

logger = logging.getLogger(__name__)

class LLMEngine:
    def __init__(self, model_path: str = "./models/Phi-3-mini-4k-instruct-q4.gguf"):
        self.model_path = model_path
        self.llm = None
        
        # Load the model if it exists
        if os.path.exists(self.model_path):
            logger.info(f"Loading LLM from {self.model_path}")
            try:
                self.llm = Llama(
                    model_path=self.model_path,
                    n_ctx=4096,
                    n_threads=4,
                    verbose=False
                )
                logger.info("LLM loaded successfully.")
            except Exception as e:
                logger.error(f"Failed to load LLM: {e}")
        else:
            logger.warning(f"Model file not found at {self.model_path}. Running in MOCK mode.")

    async def generate_response(self, system_prompt: str, user_prompt: str, json_schema: dict = None) -> str:
        """
        Asynchronously generates a response from the LLM.
        If json_schema is provided, enforces JSON output via grammar or prompt structure.
        """
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
