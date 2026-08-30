# Pinch Memory Integration

Repo: https://github.com/motimilo/pinch-memory

Purpose: token-efficient, brain-like memory (decay curves, Hebbian bonding, working/short/long/core tiers) so agents do not drown in noise.

The Memory Curator agent prefers Pinch Memory when available, falls back to AutoMem + Graphiti, then local store.

Install is owned by the Install Agent. Embedding model (e.g. nomic via LM Studio or local) is detected and configured automatically when possible.
