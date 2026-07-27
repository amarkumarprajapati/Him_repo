# Gunicorn configuration  - 12 worker will work initally - 
import multiprocessing
import signal
import sys

_cpu = multiprocessing.cpu_count()

workers = max(2, _cpu // 2)
worker_class = "gthread"
threads = max(4, _cpu)
bind = "0.0.0.0:8000"
timeout = 120
graceful_timeout = 5
keepalive = 2
max_requests = 1000
max_requests_jitter = 50
loglevel = "info"
accesslog = "-"
errorlog = "-"
reload = True


def post_fork(server, worker):
    """Configure clean signal handling in workers to suppress threading noise."""
    import threading

    original_quit = signal.getsignal(signal.SIGQUIT)
    original_term = signal.getsignal(signal.SIGTERM)

    def clean_exit(signum, frame):
        for t in threading.enumerate():
            if t is not threading.main_thread() and not t.daemon:
                t.daemon = True
        if signum == signal.SIGQUIT and callable(original_quit):
            original_quit(signum, frame)
        elif signum == signal.SIGTERM and callable(original_term):
            original_term(signum, frame)
        else:
            sys.exit(0)

    signal.signal(signal.SIGQUIT, clean_exit)
    signal.signal(signal.SIGTERM, clean_exit)


def worker_exit(server, worker):
    """Clean up thread pools before worker exit to prevent noisy shutdown."""
    try:
        import concurrent.futures.thread
        concurrent.futures.thread._threads_queues.clear()
    except (ImportError, AttributeError):
        pass
