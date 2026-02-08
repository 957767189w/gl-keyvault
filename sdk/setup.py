from setuptools import setup, find_packages

setup(
    name="gl-keyvault",
    version="0.1.0",
    description="Secure API key management SDK for GenLayer Intelligent Contracts",
    long_description=open("../README.md").read(),
    long_description_content_type="text/markdown",
    author="gl-keyvault contributors",
    url="https://github.com/genlayer-foundation/gl-keyvault",
    packages=find_packages(),
    python_requires=">=3.10",
    install_requires=[],  # No external deps - works inside GenVM
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Security :: Cryptography",
        "Topic :: Software Development :: Libraries",
    ],
)
