import os
from datetime import timedelta
from pathlib import Path
import socket
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    raw_value = os.environ.get(name, default)
    return [item.strip() for item in raw_value.split(",") if item.strip()]


def detect_lan_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return None


def merge_unique(*values):
    merged = []
    seen = set()
    for value in values:
        if not value or value in seen:
            continue
        seen.add(value)
        merged.append(value)
    return merged

DEBUG = env_bool("DEBUG", default=False)
SECRET_KEY = os.environ.get("SECRET_KEY")

if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "django-insecure-dev-only-change-me"
    else:
        raise ImproperlyConfigured("SECRET_KEY must be set when DEBUG=False")

_LAN_IP = detect_lan_ip()
ALLOWED_HOSTS = merge_unique(
    *env_list("ALLOWED_HOSTS", "localhost,127.0.0.1"),
    _LAN_IP,
)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    "authentication",
    "device",
    "session_manager",
    "telemetry",
    "synchronization",
    "events",
    "reports",
    "notifications",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"


DATABASE_ENGINE = os.environ.get("DATABASE_ENGINE", "postgresql").lower()

if DATABASE_ENGINE == "sqlite":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": os.environ.get("SQLITE_NAME", BASE_DIR / "db.sqlite3"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("DB_NAME", "telemetry_db"),
            "USER": os.environ.get("DB_USER", "postgres"),
            "PASSWORD": os.environ.get("DB_PASSWORD", "password"),
            "HOST": os.environ.get("DB_HOST", "localhost"),
            "PORT": os.environ.get("DB_PORT", "5432"),
            "CONN_MAX_AGE": int(os.environ.get("DB_CONN_MAX_AGE", "60")),
        }
    }


CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
        "LOCATION": str(BASE_DIR / "cache"),
    }
}

SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization

LANGUAGE_CODE = "en-us"

TIME_ZONE = "Asia/Kolkata"

USE_I18N = True

USE_L10N = True

USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

AUTH_USER_MODEL = "authentication.User"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

DATETIME_DISPLAY_FORMAT = "%d-%m-%Y %H:%M:%S"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Himshravan V1 EWCPS API",
    "DESCRIPTION": (
        "API documentation for **Himshravan V1 — Electronic Warfare Command Post System (EWCPS)**.\n\n"
        "Covers Authentication, Session Management, Device Discovery (device_info), "
        "the six telemetry subsystems (Direction Finding, Monitoring, Drone Detection, "
        "Cellular Active, Cellular Passive, Satellite Interception), Synchronization status & "
        "retry tracking, Event/Threat log with acknowledgement, Reports, and CSV Export."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=36500),
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

EXPORTS_DIR = BASE_DIR / "exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
HIMSHRAVAN_SYNC = {
    "MAX_RETRIES": int(os.environ.get("HIMSHRAVAN_SYNC_MAX_RETRIES", "4")),
    "RETRY_BACKOFF_SECONDS": [5, 10, 30, 60],
}

_FRONTEND_PORT = os.environ.get("FRONTEND_PORT", "3000")
_LAN_CORS_ORIGINS = []
if _LAN_IP:
    _LAN_CORS_ORIGINS = [
        f"http://{_LAN_IP}:{_FRONTEND_PORT}",
        f"http://{_LAN_IP}:3001",
        f"http://{_LAN_IP}:8001",
    ]

CORS_ALLOWED_ORIGINS = merge_unique(
    *env_list(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://192.168.0.114:3000,http://192.168.0.114:3001,http://192.168.0.114:8001,http://192.78.10.34:3000,http://192.78.10.34:3001,http://192.78.10.34:8000,http://10.10.202.21:30301,http://10.10.202.21:30800"
    ),
    *_LAN_CORS_ORIGINS,
)

CORS_ALLOW_CREDENTIALS = env_bool("CORS_ALLOW_CREDENTIALS", default=True)

CORS_ALLOW_CREDENTIALS = env_bool("CORS_ALLOW_CREDENTIALS", default=True)

CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]

CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]

_LAN_CSRF_ORIGINS = []
if _LAN_IP:
    _LAN_CSRF_ORIGINS = [
        f"http://{_LAN_IP}:3001",
        f"http://{_LAN_IP}:8001",
    ]

CSRF_TRUSTED_ORIGINS = merge_unique(
    *env_list(
        "CSRF_TRUSTED_ORIGINS",
        "http://localhost:3001,http://127.0.0.1:3001,http://192.168.0.114:3001,http://192.168.0.114:8001,http://192.78.10.34:3001,http://192.78.10.34:8000"
    ),
    *_LAN_CSRF_ORIGINS,
)

if not DEBUG:
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_BROWSER_XSS_FILTER = True
    X_FRAME_OPTIONS = "DENY"
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", default=True)
    SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", default=True)
    SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", default=True)

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")


LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "file": {
            "level": "INFO",
            "class": "logging.FileHandler",
            "filename": str(BASE_DIR / "logs" / "django.log"),
            "formatter": "verbose",
        },
        "console": {
            "level": "INFO",
            "class": "logging.StreamHandler",
            "formatter": "simple",
        },
    },
    "root": {
        "handlers": ["console", "file"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
