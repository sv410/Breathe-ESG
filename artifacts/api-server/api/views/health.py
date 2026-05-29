from django.http import JsonResponse, HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Breathe ESG API</title>
        <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f2f5; }
            .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
            .status { color: #10b981; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>Breathe ESG API</h1>
            <p>Status: <span class="status">Running</span></p>
            <p>The backend is active and ready to serve requests.</p>
        </div>
    </body>
    </html>
    """
    return HttpResponse(html_content)

@api_view(["GET"])
@permission_classes([AllowAny])
def api_health(request):
    return JsonResponse({"ok": True})
