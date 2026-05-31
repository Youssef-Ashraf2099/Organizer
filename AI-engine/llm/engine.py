"""
LLM engine for the Organizer AI stack.

This backend now talks to gemini-web2api over the OpenAI-compatible
`/v1/chat/completions` endpoint. It keeps the existing FastAPI and LangGraph
contract intact while removing the local GGUF model dependency and the Docker
requirement.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import AsyncGenerator, Literal, Optional

import httpx

logger = logging.getLogger(__name__)

DEFAULT_MODEL = os.getenv("AI_GEMINI_MODEL", "gemini-3.5-flash-thinking")
DEFAULT_BASE_URL = os.getenv("AI_GEMINI_BASE_URL", "http://127.0.0.1:8081/v1")


def _normalize_base_url(base_url: str) -> str:
    return base_url.rstrip("/")


def _trim_middle(text: str, max_chars: int, marker: str) -> str:
    if len(text) <= max_chars:
        return text

    if max_chars <= len(marker) + 32:
        return text[:max_chars]

    keep_start = max_chars // 2
    keep_end = max_chars - keep_start - len(marker)
    return text[:keep_start] + marker + text[-keep_end:]


class LLMEngine:
    def __init__(self, model_path: str = DEFAULT_MODEL) -> None:
        self.base_url = _normalize_base_url(os.getenv("AI_GEMINI_BASE_URL", DEFAULT_BASE_URL))
        self.api_key = os.getenv("AI_GEMINI_API_KEY", "").strip()
        self.model_name = os.getenv("AI_GEMINI_MODEL", model_path)
        self.model_path = self.model_name

        self.structured_temperature = float(os.getenv("AI_STRUCTURED_TEMP", "0.15"))
        self.writing_temperature = float(os.getenv("AI_WRITING_TEMP", "0.40"))
        self.structured_top_p = float(os.getenv("AI_STRUCTURED_TOP_P", "0.95"))
        self.writing_top_p = float(os.getenv("AI_WRITING_TOP_P", "0.92"))
        self.max_tokens = int(os.getenv("AI_MAX_TOKENS", "3072"))
        self.n_ctx = int(os.getenv("AI_N_CTX", "32768"))
        self.n_threads = 1
        self.n_batch = 1
        self.n_gpu_layers = 0
        self.vram_mb = 0
        self.gpu_backend = "remote"
        self.chat_template = "gemini-web2api"
        self.repeat_penalty = 1.0
        self.top_k = 0
        self.temperature = self.writing_temperature
        self.top_p = self.writing_top_p
        self.preload = True
        self.max_prompt_chars = int(os.getenv("AI_MAX_PROMPT_CHARS", "24000"))
        self.request_timeout_sec = float(os.getenv("AI_GEMINI_TIMEOUT", "180"))
        self._client = httpx.AsyncClient(timeout=self.request_timeout_sec)

        logger.info(
            "[LLM] Gemini Web2API backend configured | base_url=%s | model=%s | "
            "temp_writing=%.2f | temp_structured=%.2f",
            self.base_url,
            self.model_name,
            self.writing_temperature,
            self.structured_temperature,
        )

    def ensure_loaded(self) -> None:
        return

    def is_loaded(self) -> bool:
        return bool(self.base_url and self.model_name)

    def _resolve_gen_params(
        self,
        mode: Literal["auto", "writing", "structured"],
        json_schema: Optional[dict],
    ) -> dict:
        effective = mode
        if mode == "auto":
            effective = "structured" if json_schema else "writing"

        if effective == "structured":
            return {
                "temperature": self.structured_temperature,
                "top_p": self.structured_top_p,
            }

        return {
            "temperature": self.writing_temperature,
            "top_p": self.writing_top_p,
        }

    def _trim_prompt_if_needed(self, prompt: str, reserve: int = 256) -> str:
        budget = max(1024, self.max_prompt_chars - reserve)
        trimmed = _trim_middle(
            prompt,
            budget,
            "\n\n[...context trimmed to fit Gemini prompt budget...]\n\n",
        )
        if trimmed != prompt:
            logger.warning(
                "[LLM] Prompt trimmed from %d to %d chars for Gemini request.",
                len(prompt),
                len(trimmed),
            )
        return trimmed

    def _build_messages(self, system_prompt: str, user_prompt: str) -> list[dict[str, str]]:
        messages: list[dict[str, str]] = []
        system_text = self._trim_prompt_if_needed(system_prompt or "")
        user_text = self._trim_prompt_if_needed(user_prompt or "")

        if system_text.strip():
            messages.append({"role": "system", "content": system_text})
        messages.append({"role": "user", "content": user_text})
        return messages

    def _request_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def _post_completion(self, payload: dict) -> dict:
        url = f"{self.base_url}/chat/completions"
        last_error: Optional[Exception] = None

        for attempt in range(3):
            try:
                response = await self._client.post(
                    url,
                    headers=self._request_headers(),
                    json=payload,
                )
                response.raise_for_status()
                return response.json()
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "[LLM] Gemini request attempt %d failed: %s",
                    attempt + 1,
                    exc,
                )
                if attempt < 2:
                    await asyncio.sleep(0.75 * (attempt + 1))

        raise RuntimeError(f"Gemini request failed: {last_error}") from last_error

    async def generate_response(
        self,
        system_prompt: str,
        user_prompt: str,
        json_schema: dict = None,
        *,
        mode: Literal["auto", "writing", "structured"] = "auto",
        max_retries: int = 1,
    ) -> str:
        self.ensure_loaded()

        messages = self._build_messages(system_prompt, user_prompt)
        gen_params = self._resolve_gen_params(mode, json_schema)

        payload = {
            "model": self.model_name,
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": gen_params["temperature"],
            "top_p": gen_params["top_p"],
            "stream": False,
        }

        if json_schema:
            schema_text = json.dumps(json_schema, ensure_ascii=False, indent=2)
            system_index = 0 if messages and messages[0]["role"] == "system" else len(messages) - 1
            payload["messages"][system_index]["content"] += (
                "\n\nRespond using valid JSON that matches this schema:\n" + schema_text
            )

        logger.debug("[LLM] Gemini request chars=%d", len(system_prompt) + len(user_prompt))

        last_error: Optional[Exception] = None
        for attempt in range(max_retries + 1):
            try:
                data = await self._post_completion(payload)
                choice = (data.get("choices") or [{}])[0]
                message = choice.get("message") or {}
                text = (
                    message.get("content")
                    or choice.get("text")
                    or data.get("output_text")
                    or ""
                )
                text = str(text).strip()
                if text:
                    return text
                if attempt < max_retries:
                    logger.warning("[LLM] Empty Gemini response, retrying once more.")
                    continue
                return ""
            except Exception as exc:
                last_error = exc
                if attempt < max_retries:
                    logger.warning("[LLM] Retrying Gemini request after error: %s", exc)
                    continue
                break

        raise RuntimeError(f"Gemini generation failed: {last_error}") from last_error

    async def generate_stream(
        self,
        system_prompt: str,
        user_prompt: str,
        json_schema: dict = None,
        *,
        mode: Literal["auto", "writing", "structured"] = "auto",
    ) -> AsyncGenerator[str, None]:
        response = await self.generate_response(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            json_schema=json_schema,
            mode=mode,
        )
        if not response:
            return

        chunk_size = 24
        for index in range(0, len(response), chunk_size):
            await asyncio.sleep(0)
            yield response[index:index + chunk_size]

    def get_gpu_info(self) -> dict:
        return {
            "gpu_backend": self.gpu_backend,
            "vram_mb": self.vram_mb,
            "n_gpu_layers": self.n_gpu_layers,
            "n_ctx": self.n_ctx,
            "max_tokens": self.max_tokens,
            "temp_writing": self.writing_temperature,
            "temp_structured": self.structured_temperature,
            "top_k_writing": 0,
            "top_k_structured": 0,
            "repeat_penalty": self.repeat_penalty,
            "chat_template": self.chat_template,
            "model_loaded": self.is_loaded(),
            "model_path": self.model_path,
            "model_name": self.model_name,
            "base_url": self.base_url,
        }

    async def health(self) -> dict:
        info = self.get_gpu_info()
        try:
            response = await self._client.get(f"{self.base_url}/models", headers=self._request_headers())
            response.raise_for_status()
            models_payload = response.json()
            models = models_payload.get("data", []) if isinstance(models_payload, dict) else []
            available_models = [
                entry.get("id")
                for entry in models
                if isinstance(entry, dict) and entry.get("id")
            ]
            info.update(
                {
                    "status": "ok",
                    "model_loaded": True,
                    "available_models": available_models,
                }
            )
            return info
        except Exception as exc:
            logger.warning("[LLM] Health check failed: %s", exc)
            info.update(
                {
                    "status": "unavailable",
                    "model_loaded": False,
                    "error": str(exc),
                }
            )
            return info

    def context_budget(self) -> dict:
        prompt_budget = max(0, self.max_prompt_chars)
        return {
            "n_ctx": self.n_ctx,
            "max_output_tokens": self.max_tokens,
            "prompt_budget": prompt_budget,
            "rough_pages_at_1k": prompt_budget // 1000,
        }


engine = LLMEngine()
