from supabase import create_client

from app.config import settings

_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def upload_pdf(file_bytes: bytes, destination_path: str) -> str:
    """Upload a PDF to the 'dpp-files' Supabase Storage bucket.

    Returns a signed URL valid for 1 hour.
    The bucket must be created in Supabase Dashboard and set to private/non-public.
    """
    _client.storage.from_("dpp-files").upload(
        path=destination_path,
        file=file_bytes,
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )
    result = _client.storage.from_("dpp-files").create_signed_url(destination_path, 3600)
    return result["signedURL"]
