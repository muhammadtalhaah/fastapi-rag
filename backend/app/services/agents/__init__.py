"""Agent package: the function-based agent contract, the registry, and agents."""

from services.agents import rag_agent, registry, web_agent
from services.agents.base import AgentSpec, AgentStream

__all__ = ["AgentSpec", "AgentStream", "rag_agent", "web_agent", "registry"]
