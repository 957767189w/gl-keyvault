"""
gl-keyvault Python SDK for GenLayer Intelligent Contracts

Provides the SecureAPI class for making authenticated external API calls
without exposing API keys on-chain.

Usage in an Intelligent Contract:

    from genlayer import *
    from gl_keyvault import SecureAPI

    class MyContract(gl.Contract):
        result: str

        @gl.public.write
        def fetch_data(self):
            api = SecureAPI("openweather")

            def nondet():
                data = api.get("/data/2.5/weather?q=Tokyo&units=metric")
                return data["main"]["temp"]

            self.result = gl.eq_principle_strict_eq(nondet)
"""

from .secure_api import SecureAPI

__all__ = ["SecureAPI"]
__version__ = "0.1.0"
