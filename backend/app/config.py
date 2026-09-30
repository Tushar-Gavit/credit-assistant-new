from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 1440
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5-5"
    cors_origins: str = "http://localhost:5173"


settings = Settings()
