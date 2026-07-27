from __future__ import annotations

import asyncio
import logging
import threading

from .df_poller import df_poller
from .heartbeat import heartbeat_loop
from .monitoring_consumer import monitoring_consumer

logger = logging.getLogger(__name__)

_heartbeat_task: asyncio.Task | None = None
_monitoring_task: asyncio.Task | None = None
_df_task: asyncio.Task | None = None
_thread: threading.Thread | None = None


def _run_async_loop() -> None:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    global _heartbeat_task, _monitoring_task, _df_task
    _heartbeat_task = loop.create_task(heartbeat_loop())
    _monitoring_task = loop.create_task(monitoring_consumer())
    _df_task = loop.create_task(df_poller())

    try:
        loop.run_forever()
    except asyncio.CancelledError:
        pass
    finally:
        try:
            pending = asyncio.all_tasks(loop)
            for task in pending:
                task.cancel()
            if pending:
                loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
        except Exception:
            pass
        finally:
            loop.close()


def start_background_tasks() -> None:
    global _thread
    if _thread is not None and _thread.is_alive():
        logger.debug("Telemetry background tasks already running")
        return

    _thread = threading.Thread(target=_run_async_loop, daemon=True, name="telemetry-bg")
    _thread.start()
    logger.info("Telemetry background tasks started")


def stop_background_tasks() -> None:
    global _heartbeat_task, _monitoring_task, _df_task, _thread
    if _thread and _thread.is_alive():
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.call_soon_threadsafe(loop.stop)
        except Exception:
            pass
    if _heartbeat_task:
        _heartbeat_task.cancel()
    if _monitoring_task:
        _monitoring_task.cancel()
    if _df_task:
        _df_task.cancel()
