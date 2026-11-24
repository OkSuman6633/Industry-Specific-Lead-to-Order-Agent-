from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Brilliant Brains"
    environment: str = "development"
    database_path: str = "./data/brilliant_brains.db"
    jwt_secret: str = "development-only-change-me"
    jwt_expire_minutes: int = 720
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    allow_demo_login: bool = True
    whatsapp_app_secret: str = "bb_dev_whatsapp_secret_2026"
    whatsapp_verify_token: str = "bb_dev_verify_token_2026"
    qualification_quota_per_minute: int = 60
    enforce_territories: bool = True
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

settings = Settings()
