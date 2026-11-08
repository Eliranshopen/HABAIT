"""Adapters of the live bench (card 29): one per fal endpoint family. load(endpoint, entry) -> Adapter.

An adapter turns a track job (the fixed 846 input + prompts) into the endpoint's request and prices it from
registry.json. Adapters never touch the network: habait_bench.fal_call() is the only code that does.
"""
import importlib

from .base import Adapter  # noqa: F401


def load(endpoint, entry):
    mod = importlib.import_module(f"{__name__}.{entry.get('adapter', 'base')}")
    return getattr(mod, "ADAPTER", Adapter)(endpoint, entry)
