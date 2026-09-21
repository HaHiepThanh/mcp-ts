# Observations — two LLMs behind the same MCP servers

Numbers come from [`model-comparison.md`](model-comparison.md) (11 benchmark cases × 2 runs per model, ground truth taken from the MCP tools themselves). Hardware: Apple M4 Pro, 24 GB; Qwen runs on the Mac's GPU through Ollama.

## What we compared

| Configuration | Where it runs | Cost | Data leaves the machine? |
| --- | --- | --- | --- |
| `gemini-3.5-flash-lite` | Google cloud (free tier) | free within rate limits | yes (sample data is fake) |
| `gemini-3.8-flash` | Google cloud (free tier) | free within a small daily quota | yes |
| `qwen3:4b-instruct` | this Mac, Ollama, 3.3 GB RAM, 8k context | free, no limits | no |
| `qwen3:4b` (thinking) | this Mac, Ollama, 3.2 GB RAM, 8k context | free, no limits | no |

Only `config/host.json` ↔ `config/host.qwen.json` differ — the MCP servers, tools and host code are identical. That is the point of MCP: **the model is swappable, the integration is not rewritten.**

## Findings

1. **Accuracy: every measured model passed 22/22 turns.** Right tools, right arguments (including the tricky "change only the final score" case) and the exact ground-truth numbers. With clear tool names, `.describe()` on every parameter and structured results, even a 4-billion-parameter local model uses the tools correctly. *Tool design matters more than model size for this task.*
2. **Speed: the local instruct model was the fastest** — median 2.1 s per turn vs 2.7 s for Gemini Flash-Lite, and it never waited for a rate limit.
3. **"Thinking" costs ~10× time for no gain here.** `qwen3:4b` (thinking variant) needed a median 24.4 s per turn and produced ~13× more output tokens (1468 vs 109) for the same 100 % result. Reasoning pays off on hard problems, not on "call the right tool and report the number".
4. **Free cloud tiers are the real bottleneck.** Gemini Flash-Lite needed 5 rate-limit retries in 22 turns. `gemini-3.8-flash` could **not be measured**: our first benchmark run used up its free daily quota (131 retries, answers silently served by fallback models), so the rerun stopped after two `429 quota exhausted` errors. Lesson: benchmarks must disable model fallback and record which model actually answered — otherwise results are mislabelled.
5. **MCP overhead is negligible.** Tool calls take 2–40 ms; LLM requests take 99 % of a turn (see `results.md` §8).
6. **Model name ≠ model behaviour.** In Ollama, `qwen3:4b` is the *Thinking-2507* build and thinking cannot be switched off through the API (`/no_think` and `think:false` were tested). The non-thinking build is `qwen3:4b-instruct`.
7. **Context window is a hidden requirement.** The 13 tool definitions are ~4.8k tokens; Ollama's default 4k context would silently cut them. We run Ollama with `OLLAMA_CONTEXT_LENGTH=8192` (+ flash attention and q8 KV cache to keep RAM at ~3.3 GB).

## Recommendation (for the demo and phase 2)

| Goal | Choose |
| --- | --- |
| Live demo on stage (no internet risk, no quota) | `qwen3:4b-instruct` locally |
| Best quality answers / longer reports | Gemini (Flash-Lite for speed; larger Flash when quota allows) |
| Private data | local model — nothing leaves the machine |

## Limits of this benchmark

11 questions over a small synthetic dataset; each case run twice. All measured models reached 100 %, so the benchmark does not separate them on accuracy — phase 2 should add harder cases (ambiguous names, multi-class aggregates, questions that need 3+ tools) and the team's real `test_cases.csv`.
