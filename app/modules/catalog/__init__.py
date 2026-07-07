"""Catalog package: avoid importing submodules at package import time
to prevent circular import errors during application startup.

Import specific symbols from submodules where needed (inside functions
or at runtime) instead of here.
"""

__all__ = ["models", "repository", "service"]