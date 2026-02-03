# AEGIS

**Autonomous Economic Guardian & Investment System** — a multi-agent AI swarm that monitors, explains, and (optionally) executes DeFi portfolio actions on **Solana**.

This repository is intentionally a **foundation-only** monorepo: clean structure, dependency baselines, and placeholders for subsequent coding agents. No business logic is implemented yet.

## Monorepo Structure (Turborepo)

- `apps/web` — Next.js 14 + Tailwind UI (Privy embedded wallet + React Query)
- `apps/agents` — Node.js/TypeScript agent swarm (Solana Agent Kit v2 + LangGraph)
- `packages/contracts` — Anchor on-chain program skeleton (vault / policy layer)
- `packages/shared` — shared types/utilities (kept dependency-light)

## Swarm Architecture (High level)

AEGIS is designed as a **specialized agent swarm** coordinated by an orchestrator:

- **OVERSEER (orchestrator):** routes tasks, manages consensus/voting, enforces human-in-the-loop approval
- **ANALYST (research):** market + on-chain signals, token/portfolio analysis
- **TRADER (execution):** quotes/routes/swaps (Jupiter Ultra), builds transactions
- **SENTINEL (risk):** monitoring, stop-loss/take-profit triggers, rebalancing suggestions
- **SCRIBE (communication):** natural-language explanations, reports, activity summaries

Data + execution integrations (planned):

- **Helius** (RPC, webhooks, DAS) for realtime on-chain data
- **Jupiter Ultra** for best execution / MEV-aware swaps
- **Privy** for embedded wallet auth + transaction approvals

For the target architecture and hackathon plan, see `docs/CLAW_HACKATHON_ARCHITECTURE.md`.

## Getting Started

### Prereqs

- Node.js **20+**
- npm **10+**

### Install

From repo root:

```bash
npm install
```

### Dev

Run everything that has a `dev` task:

```bash
npm run dev
```

Run only the web app:

```bash
cd apps/web
npm run dev
```

Run only agents:

```bash
cd apps/agents
npm run dev
```

### Environment Variables

Copy `.env.example` → `.env` at the repo root and fill in keys as needed.

```bash
cp .env.example .env
```

> Note: `apps/web` currently wraps the app in a `PrivyProvider` via `app/providers.tsx`.

## Contracts (Anchor)

`packages/contracts` contains an **Anchor skeleton**.

- `npm run build` at repo root will **skip** contract builds if `anchor` is not installed.
- To build contracts explicitly (requires Anchor CLI):

```bash
cd packages/contracts
npm run anchor:build
```

## Notes for Subsequent Agents

- Keep `packages/shared` dependency-light (types and tiny utilities only).
- Implement orchestration in `apps/agents/src/workflows/swarm.ts` (LangGraph).
- Keep execution boundaries enforceable on-chain (Agent Authority PDA + user policy constraints).

## License

TBD.
