from llama_cpp import Llama
import logging
import os
import asyncio
import subprocess
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_MODEL = os.path.join(BASE_DIR, "Memory", "models", "gemma-4-e2b-it-q4_k_m.gguf")


# ─── GPU Backend ──────────────────────────────────────────────────────────────

class GpuBackend(Enum):
    CUDA = "cuda"   # NVIDIA — primary (requires CUDA build of llama-cpp-python)
    ROCM = "rocm"   # AMD   — future  (requires ROCm build of llama-cpp-python)
    CPU  = "cpu"    # Fallback


def detect_gpu_backend() -> GpuBackend:
    """Auto-detect best GPU backend. Priority: NVIDIA CUDA > AMD ROCm (stub) > CPU."""
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0 and result.stdout.strip():
            gpu_name = result.stdout.strip().splitlines()[0]
            logger.info(f"[GPU] NVIDIA detected: {gpu_name} -> CUDA backend")
            return GpuBackend.CUDA
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    # TODO: AMD ROCm — uncomment when ROCm llama-cpp-python build is installed
    # pip install llama-cpp-python --upgrade --force-reinstall \
    #   --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/rocm
    # try:
    #     result = subprocess.run(["rocm-smi","--showid"],capture_output=True,text=True,timeout=5)
    #     if result.returncode == 0:
    #         return GpuBackend.ROCM
    # except FileNotFoundError:
    #     pass

    logger.info("[GPU] No NVIDIA GPU found -> CPU mode")
    return GpuBackend.CPU


# ─── Chat Templates ───────────────────────────────────────────────────────────

def format_gemma_prompt(system_prompt: str, user_prompt: str) -> str:
    """Gemma 2/4 instruction format. System prepended to user turn (no system role in Gemma)."""
    combined = f"{system_prompt}\n\n{user_prompt}" if system_prompt else user_prompt
    return f"<bos><start_of_turn>user\n{combined}<end_of_turn>\n<start_of_turn>model\n"


def format_phi3_prompt(system_prompt: str, user_prompt: str) -> str:
    """Phi-3 / Phi-3.5 instruction format."""
    return f"<|system|>\n{system_prompt}<|end|>\n<|user|>\n{user_prompt}<|end|>\n<|assistant|>\n"


CHAT_TEMPLATES = {
    "gemma": format_gemma_prompt,
    "phi":   format_phi3_prompt,
    "phi3":  format_phi3_prompt,
}


def detect_chat_template(model_path: str) -> str:
    """Infer chat template from model filename."""
    name = os.path.basename(model_path).lower()
    if "gemma" in name:
        return "gemma"
    if "phi" in name:
        return "phi3"
    logger.warning(f"[LLM] Unknown model family in '{name}' - defaulting to gemma")
    return "gemma"


# ─── LLM Engine ───────────────────────────────────────────────────────────────

class LLMEngine:
    def __init__(self, model_path: str = DEFAULT_MODEL):
        self.model_path    = model_path
        self.llm: Optional[Llama] = None
        self._load_error: Optional[str] = None

        self.gpu_backend   = detect_gpu_backend()
        self.n_ctx         = int(os.getenv("AI_N_CTX",      "4096"))
        self.n_threads     = int(os.getenv("AI_N_THREADS",  "4"))
        self.n_batch       = int(os.getenv("AI_N_BATCH",    "512"))
        self.max_tokens    = int(os.getenv("AI_MAX_TOKENS", "768"))
        self.preload       = os.getenv("AI_PRELOAD_MODEL", "1") == "1"

        # GPU layers: -1 = offload ALL layers to GPU (CUDA/ROCm), 0 = CPU
        default_gpu_layers = "-1" if self.gpu_backend in (GpuBackend.CUDA, GpuBackend.ROCM) else "0"
        self.n_gpu_layers  = int(os.getenv("AI_N_GPU_LAYERS", default_gpu_layers))

        self.chat_template = detect_chat_template(self.model_path)
        logger.info(
            f"[LLM] template={self.chat_template} | "
            f"gpu={self.gpu_backend.value} | n_gpu_layers={self.n_gpu_layers}"
        )

        if self.preload:
            self._load_model()

    def _load_model(self) -> None:
        if self.llm is not None:
            return
        if not os.path.exists(self.model_path):
            logger.warning(f"[LLM] Model not found: '{self.model_path}'. MOCK mode active.")
            return
        logger.info(f"[LLM] Loading: {self.model_path}")
        try:
            self.llm = Llama(
                model_path=self.model_path,
                n_ctx=self.n_ctx,
                n_threads=self.n_threads,
                n_gpu_layers=self.n_gpu_layers,
                n_batch=self.n_batch,
                verbose=False,
            )
            logger.info("[LLM] Model loaded successfully.")
        except Exception as e:
            self._load_error = str(e)
            logger.error(f"[LLM] Failed to load: {e}")

    def ensure_loaded(self) -> None:
        if self.llm is None:
            self._load_model()

    def is_loaded(self) -> bool:
        return self.llm is not None

    def _format_prompt(self, system_prompt: str, user_prompt: str) -> str:
        formatter = CHAT_TEMPLATES.get(self.chat_template, format_gemma_prompt)
        return formatter(system_prompt, user_prompt)

    async def generate_response(self, system_prompt: str, user_prompt: str, json_schema: dict = None) -> str:
        self.ensure_loaded()
        if not self.llm:
            logger.warning("[LLM] Not loaded - returning mock response.")
            return (
                '```tool_command\n'
                '{"action":"insert_blocks","description":"Mock","params":{"blocks":[{"type":"paragraph","content":"Mock AI: model not loaded."}]}}\n'
                '```\nMock response — model file not found.'
            )
        prompt = self._format_prompt(system_prompt, user_prompt)
        stop_tokens = ["<end_of_turn>", "<|end|>", "<|endoftext|>", "<|im_end|>"]
        response = await asyncio.to_thread(
            self.llm, prompt,
            max_tokens=self.max_tokens,
            stop=stop_tokens,
            echo=False,
        )
        return response["choices"][0]["text"].strip()

    def get_gpu_info(self) -> dict:
        return {
            "gpu_backend": self.gpu_backend.value,
            "n_gpu_layers": self.n_gpu_layers,
            "chat_template": self.chat_template,
        }


engine = LLMEngine()
