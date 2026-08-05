from collections.abc import Awaitable, Callable, Mapping

from app.core.config import Settings

ReadinessCheck = Callable[[], Awaitable[bool]]


def _configured_check(configured: bool) -> ReadinessCheck:
    async def check() -> bool:
        return configured

    return check


def default_readiness_checks(settings: Settings) -> dict[str, ReadinessCheck]:
    return {
        "qwen": _configured_check(settings.qwen_api_key is not None),
        "redis": _configured_check(settings.redis_url is not None),
        "supabase": _configured_check(
            settings.supabase_url is not None
            and settings.supabase_anon_key is not None
            and settings.supabase_service_role_key is not None
        ),
    }


async def evaluate_readiness(checks: Mapping[str, ReadinessCheck]) -> dict[str, bool]:
    results: dict[str, bool] = {}
    for name, check in checks.items():
        try:
            results[name] = await check()
        except Exception:  # A failed dependency check must not break the readiness endpoint.
            results[name] = False
    return results
