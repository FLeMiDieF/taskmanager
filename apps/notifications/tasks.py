from celery import shared_task
from django.core.mail import send_mail
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


@shared_task
def notify_task_update(task_id):
    from apps.tasks.models import Task
    try:
        task = Task.objects.select_related("assignee", "project").get(id=task_id)
    except Task.DoesNotExist:
        return

    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"project_{task.project_id}",
        {
            "type": "task_update",
            "data": {
                "task_id": task.id,
                "title": task.title,
                "status": task.status,
                "assignee": task.assignee.email if task.assignee else None,
            },
        },
    )


@shared_task
def send_deadline_reminders():
    from apps.tasks.models import Task
    now = timezone.now()
    soon = now + timezone.timedelta(hours=24)
    tasks = Task.objects.filter(
        deadline__gte=now,
        deadline__lte=soon,
        status__in=["todo", "in_progress"],
    ).select_related("assignee")

    for task in tasks:
        if task.assignee and task.assignee.email:
            send_mail(
                subject=f"Дедлайн задачи «{task.title}» через 24 часа",
                message=f"Задача «{task.title}» должна быть выполнена до {task.deadline.strftime('%d.%m.%Y %H:%M')}.",
                from_email=None,
                recipient_list=[task.assignee.email],
                fail_silently=True,
            )
