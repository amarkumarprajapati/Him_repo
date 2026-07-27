from .models import Notification


def create_session_notification(
    title,
    message="",
    category=Notification.CATEGORY_SESSION,
    priority=Notification.PRIORITY_LOW,
    session_id=None,
    session_name="",
    action_type="",
    triggered_by="",
):
    return Notification.objects.create(
        title=title,
        message=message,
        category=category,
        priority=priority,
        session_id=session_id,
        session_name=session_name,
        action_type=action_type,
        triggered_by=triggered_by,
    )
