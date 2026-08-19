from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Default / primary
    llm_provider: str = "groq"
    llm_model: str = "llama-3.3-70b-versatile"
    llm_base_url: str = "https://api.groq.com/openai/v1"

    # Free-tier keys (add as many as you want)
    groq_api_key: str = ""
    openai_api_key: str = ""
    cerebras_api_key: str = ""
    deepseek_api_key: str = ""

    # Optional model overrides
    cerebras_model: str = "llama-3.3-70b"
    deepseek_model: str = "deepseek-chat"
    openai_model: str = "gpt-4o-mini"

    # GitHub
    github_token: str = ""
    github_default_owner: str = ""

    # Server
    cors_origins: str = "http://localhost:5173,https://autonomous-coding-agent-tawny.vercel.app"
    host: str = "0.0.0.0"
    port: int = 8000
    max_iterations: int = 5

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def resolved_api_key(self) -> str:
        if self.llm_provider == "groq":
            return self.groq_api_key or self.openai_api_key
        return self.openai_api_key or self.groq_api_key

    @property
    def resolved_base_url(self):
        if self.llm_provider == "groq":
            return self.llm_base_url or "https://api.groq.com/openai/v1"
        if self.llm_base_url and "groq.com" not in self.llm_base_url:
            return self.llm_base_url
        return None


@lru_cache
def get_settings() -> Settings:
    return Settings()
