from __future__ import annotations

import csv
import logging
import os
import shutil
import threading
import time
from pathlib import Path

from .config import CSV_BATCH_SIZE, CSV_FLUSH_INTERVAL

logger = logging.getLogger(__name__)


class _CSVBuffer:
    __slots__ = ("path", "fieldnames", "rows", "lock", "last_flush")

    def __init__(self, path: Path, fieldnames: list[str]):
        self.path = path
        self.fieldnames = fieldnames
        self.rows: list[dict] = []
        self.lock = threading.Lock()
        self.last_flush = time.monotonic()


_buffers: dict[str, _CSVBuffer] = {}
_buffers_lock = threading.Lock()


def get_csv_dir() -> Path:
    from django.conf import settings

    return Path(settings.BASE_DIR)


def _atomic_append(path: Path, fieldnames: list[str], rows: list[dict]) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".csv.tmp")
    try:
        needs_header = not path.exists() or path.stat().st_size == 0
        if path.exists() and path.stat().st_size > 0:
            shutil.copy2(path, tmp)
        with open(tmp, "a", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
            if needs_header:
                writer.writeheader()
            writer.writerows(rows)
        os.replace(tmp, path)
        return True
    except PermissionError:
        try:
            with open(tmp, "a", newline="", encoding="utf-8") as fh:
                writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
                if not tmp.exists() or tmp.stat().st_size == 0:
                    writer.writeheader()
                writer.writerows(rows)
            logger.warning("CSV %s is held open; rows written to %s instead", path, tmp)
        except OSError:
            return False
        return True
    except OSError:
        return False


def _get_buffer(path: Path, fieldnames: list[str]) -> _CSVBuffer:
    key = str(path)
    with _buffers_lock:
        if key not in _buffers:
            _buffers[key] = _CSVBuffer(path, fieldnames)
        return _buffers[key]


def write_csv_rows(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    if not rows:
        return
    buf = _get_buffer(path, fieldnames)
    with buf.lock:
        buf.rows.extend(rows)
        now = time.monotonic()
        elapsed = now - buf.last_flush
        if len(buf.rows) >= CSV_BATCH_SIZE or elapsed >= CSV_FLUSH_INTERVAL:
            _flush_buffer(buf)


def flush_all() -> None:
    with _buffers_lock:
        buffers = list(_buffers.values())
    for buf in buffers:
        with buf.lock:
            if buf.rows:
                _flush_buffer(buf)


def _flush_buffer(buf: _CSVBuffer) -> None:
    to_write = buf.rows[:]
    buf.rows.clear()
    buf.last_flush = time.monotonic()
    if _atomic_append(buf.path, buf.fieldnames, to_write):
        logger.debug("Flushed %s row(s) to %s", len(to_write), buf.path)
    else:
        buf.rows.extend(to_write)
        logger.warning("Failed to flush %s row(s) to %s, re-buffered", len(to_write), buf.path)
