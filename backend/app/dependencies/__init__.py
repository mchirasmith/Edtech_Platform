"""
Dependencies package — shared FastAPI dependencies.

Key dependencies to build:
  - auth.py             get_current_user (Clerk JWT verification via JWKS, SPEC-02)
  - db.py               get_db re-exported from database.py for convenience
"""
