# Import all models so Alembic auto-discovers every table via Base.metadata.
from app.models.course import Course  # noqa: F401
from app.models.lesson import Lesson  # noqa: F401
from app.models.batch import Batch, BatchCourseLink  # noqa: F401
from app.models.enrollment import Enrollment  # noqa: F401
from app.models.progress import LessonProgress  # noqa: F401
from app.models.doubt import DoubtMessage  # noqa: F401
from app.models.test import TestQuestion, TestAttempt, Bookmark  # noqa: F401
