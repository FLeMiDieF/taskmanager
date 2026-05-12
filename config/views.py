from django.shortcuts import render


def login_view(request):
    return render(request, 'login.html')


def projects_view(request):
    return render(request, 'projects.html')


def board_view(request):
    return render(request, 'board.html')


def invite_view(request):
    return render(request, 'invite.html')
