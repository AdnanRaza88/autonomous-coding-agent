"""
Lightweight free-tier aware LLM router.

Inspired by the idea of stacking free providers + auto-fallback,
but kept extremely simple for this autonomous agent.

You put your free API keys in .env → this module tries them in priority order.
If one fails (rate-limit / quota / error) it automatically moves to the next.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from openai import AsyncOpenAI
from agent.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class ProviderConfig:
    name: str
    api_key: str
    base_url: str
    model: str
    priority: int = 100  # lower = higher priority


class FreeTierRouter:
    """
    Simple priority + fallback router for free / cheap OpenAI-compatible endpoints.
    """

    def __init__(self, providers: List[ProviderConfig]):
        # sort by priority (lowest number first)
        self.providers = sorted(
            [p for p in providers if p.api_key],
            key=lambda p: p.priority,
        )
        if not self.providers:
            logger.warning("No LLM providers configured. Add free API keys in .env")

    def _make_client(self, provider: ProviderConfig) -> AsyncOpenAI:
        return AsyncOpenAI(
            api_key=provider.api_key,
            base_url=provider.base_url,
            timeout=60.0,
        )

    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 4096,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Try providers in priority order.
        Returns the first successful response + which provider was used.
        """
        last_error: Optional[Exception] = None

        for provider in self.providers:
            client = self._make_client(provider)
            try:
                logger.info(f"Trying provider: {provider.name} ({provider.model})")
                response = await client.chat.completions.create(
                    model=provider.model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    **kwargs,
                )
                return {
                    "content": response.choices[0].message.content or "",
                    "provider": provider.name,
                    "model": provider.model,
                    "usage": response.usage.model_dump() if response.usage else None,
                    "raw": response,
                }
            except Exception as e:
                last_error = e
                logger.warning(f"Provider {provider.name} failed: {e}")
                continue

        raise RuntimeError(
            f"All free-tier providers failed. Last error: {last_error}"
        )

    def list_available(self) -> List[str]:
        return [f"{p.name} → {p.model}" for p in self.providers]


def build_default_router() -> FreeTierRouter:
    """
    Build router from environment variables.
    Priority order (you can change numbers later):
      1. Groq (fast free)
      2. Cerebras (big free daily)
      3. DeepSeek (free credits)
      4. OpenAI (if you have free credits)
      5. Any custom OpenAI-compatible base_url
    """
    s = get_settings()

    providers: List[ProviderConfig] = []

    # 1. Groq – very good free tier
    if s.groq_api_key:
        providers.append(
            ProviderConfig(
                name="groq",
                api_key=s.groq_api_key,
                base_url="https://api.groq.com/openai/v1",
                model=s.llm_model or "llama-3.3-70b-versatile",
                priority=10,
            )
        )

    # 2. Cerebras – large free daily quota
    if getattr(s, "cerebras_api_key", ""):
        providers.append(
            ProviderConfig(
                name="cerebras",
                api_key=s.cerebras_api_key,
                base_url="https://api.cerebras.ai/v1",
                model=getattr(s, "cerebras_model", "llama-3.3-70b") or "llama-3.3-70b",
                priority=20,
            )
        )

    # 3. DeepSeek
    if getattr(s, "deepseek_api_key", ""):
        providers.append(
            ProviderConfig(
                name="deepseek",
                api_key=s.deepseek_api_key,
                base_url="https://api.deepseek.com",
                model=getattr(s, "deepseek_model", "deepseek-chat") or "deepseek-chat",
                priority=30,
            )
        )

    # 4. OpenAI (free credits if any)
    if s.openai_api_key:
        providers.append(
            ProviderConfig(
                name="openai",
                api_key=s.openai_api_key,
                base_url="https://api.openai.com/v1",
                model=getattr(s, "openai_model", "gpt-4o-mini") or "gpt-4o-mini",
                priority=40,
            )
        )

    # 5. Custom / OmniRoute-style endpoint (if you point LLM_BASE_URL to OmniRoute or any other gateway)
    if s.llm_base_url and s.resolved_api_key and "groq.com" not in (s.llm_base_url or ""):
        providers.append(
            ProviderConfig(
                name="custom",
                api_key=s.resolved_api_key,
                base_url=s.llm_base_url.rstrip("/"),
                model=s.llm_model or "auto",
                priority=5,  # highest priority if you explicitly set a custom gateway
            )
        )

    return FreeTierRouter(providers)


# Singleton for easy import
_router: Optional[FreeTierRouter] = None


def get_router() -> FreeTierRouter:
    global _router
    if _router is None:
        _router = build_default_router()
    return _router
