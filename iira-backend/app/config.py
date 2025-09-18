# app/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    qdrant_host: str
    qdrant_port: int
    qdrant_api_key: str | None = None
    database_url: str
    
    ollama_api_url: str
    model_plan: str
    model_params: str
    model_sop_parser: str

    class Config:
        env_file = ".env.local"  # default local env
        env_file_encoding = "utf-8"


settings = Settings()
