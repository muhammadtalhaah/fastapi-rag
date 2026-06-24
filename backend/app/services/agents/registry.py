"""Agent registry the orchestrator dispatches through.

The orchestrator never imports concrete agents directly — it asks the registry
for the agent record matching a route key. This is what lets agents (RAG, Web
Search, ...) be added by registering a ``stream`` function here, with no change
to the router or the orchestrator.

Agents are stored as plain :class:`~services.agents.base.AgentSpec` records
(``{name, supports_stream, stream}``) — function-based, no agent classes. Routes
the router may pick but that have no registered agent yet (``general``) resolve
to ``None``; the orchestrator turns that into a safe default-route response
rather than an error.
"""

from __future__ import annotations

import logging

from services.agents import rag_agent, web_agent
from services.agents.base import AgentSpec, AgentStream

logger = logging.getLogger(__name__)

_registry: dict[str, AgentSpec] = {}


def register(name: str, stream: AgentStream, *, supports_stream: bool = True) -> None:
    """Add (or replace) an agent under its route ``name``."""
    _registry[name] = {"name": name, "supports_stream": supports_stream, "stream": stream}
    logger.info("[registry] registered agent %r", name)


def get(name: str) -> AgentSpec | None:
    """Return the agent record for ``name``, or ``None`` if none is registered."""
    return _registry.get(name)


def names() -> list[str]:
    """Route keys with a registered agent (used for logging/diagnostics)."""
    return list(_registry)


# --- Built-in registrations ------------------------------------------------
# Registered at import time so simply importing the registry wires up the
# shipped agents.
register("rag", rag_agent.stream)
register("web", web_agent.stream)
