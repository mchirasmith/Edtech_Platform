from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    CLERK_SECRET_KEY: str
    CLERK_DOMAIN: str
    CLERK_WEBHOOK_SECRET: str
    RAZORPAY_KEY_ID: str
    RAZORPAY_KEY_SECRET: str
    IMAGEKIT_PRIVATE_KEY: str
    IMAGEKIT_PUBLIC_KEY: str
    IMAGEKIT_URL_ENDPOINT: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    RESEND_API_KEY: str
    REDIS_URL: str = ""
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        env_file = ".env"


settings = Settings()
