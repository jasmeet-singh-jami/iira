# app/config.py
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    qdrant_host: str
    qdrant_port: int
    qdrant_api_key: Optional[str]
    database_url: str
    
    ollama_api_url: str
    model_plan: str
    model_params: str
    model_sop_parser: str

    # --- Redis Settings ---
    redis_host: str = "redis" # Default to Docker service name
    redis_port: int = 6379
    redis_db: int = 0
    # Optional: Add Redis password if needed
    # redis_password: Optional[str] = None

    class Config:
        env_file = ".env.local"  # default local env
        env_file_encoding = "utf-8"


settings = Settings()
