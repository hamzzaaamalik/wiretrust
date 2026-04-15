# WireTrust Protocol

> AI-powered cricket fan economy on WireFluid blockchain.
> Version 2.0.0 | Last updated: 2026-04-15

---

## Deployed Contracts (WireFluid Chain 92533)

| Contract | Address |
|----------|---------|
| FranchiseRegistry | `0x0352a16cd7B6b06707A363452d7f1937840E90D2` |
| AgentRegistry | `0x603F8Db0b75d7dc699335a8C45412EC2eE49A60c` |
| ReputationStore | `0x096A05F4F2d81617Ac93589958f9736B3DF2c915` |
| PolicyEngine | `0x0802bBe692e21ed0f7C00d7bD282ec5fAB2E582C` |
| ExecutionGateway | `0xC148f0AE3d83089217d33AA2b0b00e1F2b9e889e` |
| MatchOracle | `0x3c1D9725eD4D92484Ac45af00a0b836C95a76E86` |
| PredictionModule | `0xe175236fe8978FdEDB7d563da3498c12531b241c` |
| FantasyModule | `0x726fEb1Bdf8E4CE4ABcd273C5c1696Ed24f31d30` |
| WireTrustNFT | `0x9127EFFB479ae271601d18Bfb7CF6Af491244e1b` |
| Deployer / Treasury | `0x22EfFAe93649A93F7c6e01aBB6Ce2496BB2D4105` |

**Network:** WireFluid EVM (Chain ID: 92533) | **Deployed:** 2026-04-15 (v2 with Pausable)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Smart Contracts](#smart-contracts)
4. [6-Factor Cricket Intelligence Engine](#6-factor-cricket-intelligence-engine)
5. [AI Agent System](#ai-agent-system)
6. [Backend API](#backend-api)
7. [Frontend & Redux Store](#frontend--redux-store)
8. [Database Schema](#database-schema)
9. [Historical PSL Data](#historical-psl-data)
10. [User Flows](#user-flows)
11. [Cron Jobs & Automation](#cron-jobs--automation)
12. [Configuration](#configuration)
13. [Revenue Model](#revenue-model)
14. [Security & Audit Notes](#security--audit-notes)

---

## Overview

WireTrust is a decentralized fan engagement platform built on the WireFluid blockchain (Chain ID: 92533). It enables cricket fans to:

- **Make FREE predictions** on match outcomes and earn points
- **Join FREE fantasy contests** with sponsor-funded prize pools
- **Unlock AI agents** through fan achievements (5 predictions + 1 squad + 100 points)
- **Earn NFT rewards** (tickets, badges, collectibles, merchandise) through challenges
- **Track reputation** across all activities via on-chain scoring

### For Franchises

- **Deploy ML-powered AI agents** (Opposition Scout, Squad Form Monitor, Match Preparation)
- **Random Forest match prediction** (200 trees, 80/20 train/test split, real test accuracy)
- **Player performance forecasting** (weighted linear regression with confidence intervals)
- **Anomaly detection** (z-score analysis for breakouts and collapses)
- **Squad optimizer** (constrained knapsack algorithm with ML-predicted scores)

### Platform Stats (PSL 2026)

| Metric | Count |
|--------|-------|
| Smart Contracts | 9 deployed (with Pausable emergency stop) |
| Passing Tests | 203 |
| Frontend Pages | 30 (Home + Dashboard split) |
| Reusable Components | 19 |
| Backend Routes | 12 modules, 80+ endpoints |
| Backend Services | 13 modules (including ML engine) |
| Solidity Code | 3,400+ lines |
| PSL Teams | 8 (6 established + 2 new) |
| PSL Players | 157 |
| PSL Matches | 44 (2026 season) |
| Historical Matches | 90 (PSL 2023, 2024, 2025) |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | WireFluid (EVM-compatible, Chain 92533) |
| Smart Contracts | Solidity ^0.8.27, OpenZeppelin |
| Backend | Node.js, Express, ethers.js v6 |
| Database | PostgreSQL (Cloud SQL) |
| Frontend | React 18, Vite, Tailwind CSS |
| State Management | Redux Toolkit (RTK) |
| Auth | Web3Auth (social login) + MetaMask |
| Real-time | WebSocket relay |
| Cricket Data | Sportmonks Cricket API + ESPNcricinfo historical data |
| AI Intelligence | 6-factor engine + Random Forest ML (ml-random-forest) |
| ML Algorithms | Match prediction (RF), player forecasting (regression), squad optimizer (knapsack), anomaly detection (z-score) |
| Security | Rate limiting, CSRF protection, Pausable contracts, input validation |
| Deployment | Hardhat, PM2, Nginx |

### Project Structure

```
e:\wiretrust/
├── contracts/                    # Solidity smart contracts (3,261 lines)
│   ├── core/                     # FranchiseRegistry, AgentRegistry, ReputationStore,
│   │                             #   PolicyEngine, ExecutionGateway
│   ├── modules/                  # PredictionModule, FantasyModule, WireTrustNFT
│   ├── oracle/                   # MatchOracle
│   ├── interfaces/               # 6 contract interfaces
│   └── test/                     # SimpleTarget (test helper)
├── backend/
│   ├── index.js                  # Express app, blockchain init, cron registration
│   ├── db/
│   │   ├── index.js              # PostgreSQL pool
│   │   ├── migrate.js            # Schema migration (11 tables)
│   │   └── seedPSLHistory.js     # Real PSL 2023-2025 match data (90 matches)
│   ├── routes/                   # 12 route modules
│   │   ├── admin.js              # Super admin portal
│   │   ├── agentAuto.js          # Agent autonomous mode
│   │   ├── agents.js             # Agent CRUD + reputation
│   │   ├── auth.js               # Wallet creation + faucet
│   │   ├── challenges.js         # Fan challenges
│   │   ├── fantasy.js            # Fantasy contests (with sponsor branding)
│   │   ├── franchise-portal.js   # Franchise admin portal + analytics
│   │   ├── franchise.js          # Public franchise data
│   │   ├── health.js             # System health
│   │   ├── matches.js            # Match schedule + players
│   │   ├── nfts.js               # NFT verification + metadata
│   │   └── predictions.js        # Prediction leaderboard + history
│   ├── services/                 # 10 service modules
│   │   ├── agentRunner.js            # Fan agent loop (PERCEIVE → REASON → ACT)
│   │   ├── franchiseAgentRunner.js   # Franchise AI agents (Scout, Form, Match Prep)
│   │   ├── franchiseIntelligence.js  # Franchise-specific intelligence layer
│   │   ├── mlEngine.js               # ML engine (Random Forest, regression, knapsack, z-score)
│   │   ├── cricketIntelligence.js    # 6-factor analysis engine (13 functions)
│   │   ├── cricApi.js                # Sportmonks API wrapper
│   │   ├── faucetService.js          # Auto-fund new wallets (atomic DB insert)
│   │   ├── matchSync.js              # Sportmonks → DB sync
│   │   ├── oracleService.js          # Oracle submission helper
│   │   ├── walletService.js          # Wallet management
│   │   ├── wsRelay.js                # WebSocket event relay (with schema validation)
│   │   └── strategies/
│   │       ├── predictionStrategy.js  # 6-factor prediction logic
│   │       └── fantasyStrategy.js     # Squad building + matchup analysis
│   └── middleware/
│       ├── auth.js                    # Wallet-based auth
│       └── rateLimiter.js             # 3-tier rate limiting (strict/moderate/relaxed)
├── frontend/
│   ├── src/
│   │   ├── pages/                # 30 page components
│   │   │   ├── Home.jsx          # Landing page (visitors)
│   │   │   ├── Dashboard.jsx     # Connected user dashboard
│   │   │   ├── *.jsx             # 11 other public pages
│   │   │   ├── admin/            # 9 admin pages
│   │   │   └── franchise/        # 9 franchise pages (includes AI Agents)
│   │   ├── components/           # 19 reusable components
│   │   ├── store/                # Redux Toolkit store
│   │   │   ├── index.js          # Store configuration
│   │   │   └── slices/           # 4 slices (wallet, agents, matches, fantasy)
│   │   ├── contexts/             # WalletContext (syncs to Redux), ToastContext
│   │   ├── hooks/                # useWebSocket, useContract, useReputation
│   │   ├── utils/                # Helpers, ABI loader, error formatting
│   │   └── abis/                 # Contract ABIs
│   └── vite.config.js
├── scripts/                      # Deploy and seed scripts
├── test/                         # 203 passing tests
│   ├── core/                     # Core contract tests
│   ├── modules/                  # Module tests
│   ├── oracle/                   # Oracle tests
│   ├── Integration.test.js       # End-to-end protocol tests
│   └── NewFeatures.test.js       # Tests for all new features (Pausable, NFT marketplace, ML)
├── scripts/                      # Deploy and seed scripts
├── deployed-addresses.json
└── hardhat.config.js
```

---

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FAN / FRANCHISE ADMIN                          │
│                     Browser (React 18 + Vite + Tailwind)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │Dashboard │ │Predictions│ │ Fantasy  │ │ Agents   │ │Franchise     │ │
│  │          │ │          │ │          │ │ Hub      │ │Analytics     │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘ │
│       │             │            │             │              │         │
│  ┌────▼─────────────▼────────────▼─────────────▼──────────────▼───────┐ │
│  │              Redux Store (RTK)                                     │ │
│  │  walletSlice │ agentSlice │ matchSlice │ fantasySlice              │ │
│  └────────────────────────────┬───────────────────────────────────────┘ │
│       │                       │                                         │
│  ┌────▼───────────────┐  ┌───▼──────────────────┐                     │
│  │ WalletContext       │  │ Web3Auth / MetaMask   │                     │
│  │ (syncs → Redux)     │  │ (Social Login)        │                     │
│  └────────┬────────────┘  └───┬──────────────────┘                     │
└───────────┼───────────────────┼─────────────────────────────────────────┘
            │ REST API          │ ethers.js v6 (direct contract calls)
            │ + WebSocket       │
┌───────────▼───────────────────▼─────────────────────────────────────────┐
│                        BACKEND (Node.js + Express)                      │
│                            Port 3001                                    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │                   12 Route Modules                       │            │
│  │  health │ auth │ matches │ predictions │ fantasy │ agents│            │
│  │  nfts │ challenges │ admin │ franchise-portal │ agentAuto│            │
│  └────────────────────────┬────────────────────────────────┘            │
│                           │                                             │
│  ┌────────────────────────▼────────────────────────────────┐            │
│  │              Service Layer                               │            │
│  │                                                          │            │
│  │  ┌──────────────────────────────────────────────┐        │            │
│  │  │    6-Factor Cricket Intelligence Engine       │        │            │
│  │  │                                              │        │            │
│  │  │  ┌────────┐ ┌──────┐ ┌─────┐ ┌──────────┐   │        │            │
│  │  │  │  ELO   │ │ EWMA │ │ H2H │ │ Momentum │   │        │            │
│  │  │  │ (25%)  │ │(20%) │ │(15%)│ │  (15%)   │   │        │            │
│  │  │  └────────┘ └──────┘ └─────┘ └──────────┘   │        │            │
│  │  │  ┌────────────┐ ┌───────────────────────┐    │        │            │
│  │  │  │   Venue    │ │  Role-Weighted Form   │    │        │            │
│  │  │  │   (15%)    │ │       (10%)           │    │        │            │
│  │  │  └────────────┘ └───────────────────────┘    │        │            │
│  │  │  + Toss Impact + Player-vs-Team Matchups     │        │            │
│  │  └──────────────────────────────────────────────┘        │            │
│  │                                                          │            │
│  │  ┌─────────────┐ ┌──────────────┐ ┌───────────────┐     │            │
│  │  │ Agent Runner │ │ Prediction   │ │ Fantasy       │     │            │
│  │  │ (Autonomous) │ │ Strategy     │ │ Strategy      │     │            │
│  │  │ PERCEIVE →   │ │ (6-factor)   │ │ (matchup-     │     │            │
│  │  │ REASON → ACT │ │              │ │  aware)       │     │            │
│  │  └─────────────┘ └──────────────┘ └───────────────┘     │            │
│  └──────────────────────────────────────────────────────────┘            │
│                           │                                             │
│  ┌────────────────────────▼───────────────────────────┐                 │
│  │  WebSocket Relay (wsRelay.js)                       │                 │
│  │  Real-time: AgentExecuted, AgentViolation,          │                 │
│  │  PredictionResolved, SquadJoined                    │                 │
│  └─────────────────────────────────────────────────────┘                │
└──────────┬─────────────────────────────────┬────────────────────────────┘
           │                                 │
┌──────────▼──────────┐         ┌────────────▼────────────────────────────┐
│    PostgreSQL       │         │      WireFluid Blockchain               │
│    (Cloud SQL)      │         │      Chain ID: 92533                    │
│                     │         │      RPC: https://evm.wirefluid.com     │
│  11 tables:         │         │                                         │
│  users              │         │  ┌─────────────────────────────────┐    │
│  matches (134 rows) │         │  │   9 Smart Contracts              │    │
│  players (157 rows) │         │  │                                  │    │
│  match_players      │         │  │  FranchiseRegistry               │    │
│  challenges         │         │  │  AgentRegistry                   │    │
│  challenge_claims   │         │  │  ReputationStore                 │    │
│  faucet_history     │         │  │  PolicyEngine (8 checks)         │    │
│  live_match_state   │         │  │  ExecutionGateway (1% fee)       │    │
│  player_match_stats │         │  │  PredictionModule                │    │
│  contest_sponsors   │         │  │  FantasyModule (2% fee)          │    │
│  agent_decisions    │         │  │  WireTrustNFT (2.5% resale fee)  │    │
│                     │         │  │  MatchOracle                     │    │
└─────────────────────┘         │  └─────────────────────────────────┘    │
                                └─────────────────────────────────────────┘
           │
┌──────────▼──────────┐
│   Sportmonks        │
│   Cricket API       │
│   (Cron sync)       │
│   T20I, BBL, CSA    │
└─────────────────────┘
```

### Agent Execution Pipeline

```
Fan deploys Agent on-chain (AgentRegistry)
        │
        ▼
Fan sets Policy (PolicyEngine) ── PERMANENTLY LOCKED after deploy
        │
        ▼
Fan starts Autonomous Mode (POST /agents/auto/:id/start)
        │
        ▼
┌───────────────────────────────────────────────────┐
│              AGENT RUNNER LOOP                     │
│              (configurable interval, default 60s)  │
│                                                    │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│   │ PERCEIVE │───▶│  REASON  │───▶│   ACT    │   │
│   │          │    │          │    │          │   │
│   │ • Oracle │    │ • 6-Factor│   │ • Execute│   │
│   │ • DB     │    │   Intel  │    │   on-chain│  │
│   │ • Matches│    │ • Strategy│   │ • Record │   │
│   │ • Players│    │ • Matchups│   │   result │   │
│   └──────────┘    └──────────┘    └──────────┘   │
│                                                    │
│   Match Discovery: Oracle → DB fallback            │
│   Intelligence: 6-factor composite model           │
│   Actions: Predict, Build Squad, Join Contest      │
└───────────────────────────────────────────────────┘
        │
        ▼
ExecutionGateway validates:
  1. Agent ownership     5. Per-action amount limit
  2. Agent active        6. Daily cumulative limit
  3. Target not forbidden 7. Frequency cooldown
  4. Nonce not consumed   8. Max active positions
        │
        ▼
ReputationStore records outcome:
  Success → +2 score    Failure → -5 score    Violation → -10 score
```

### Sponsor-Funded Contest Flow

```
Franchise Admin                    Sponsor                     Fan
     │                               │                          │
     │  Create Contest               │                          │
     │  + Set sponsor branding       │                          │
     │  (name, logo, banner)         │                          │
     ├──────────────────────────────▶│                          │
     │                               │  Fund Prize Pool         │
     │                               │  (ETH → FantasyModule)   │
     │                               ├─────────────────────────▶│
     │                               │                          │  Join FREE
     │                               │                          │  Build 11-player squad
     │                               │                          │  Captain (2x) + VC (1.5x)
     │                               │                          │
     │  Match Completes              │                          │
     │  One-click Settlement         │                          │
     ├───────────────────────────────┼──────────────────────────┤
     │                               │                     Prize│distributed
     │                               │                  (minus 2% fee)
```

### User Types

| Role | Access | What They Do |
|------|--------|-------------|
| **Fan** | Public pages | Predict, play fantasy, claim NFTs, deploy agents |
| **Franchise Admin** | `/franchise/*` | Manage matches, players, challenges, contests, analytics |
| **Super Admin (PSL)** | `/admin/*` | Full platform control, treasury, settlement, oracle |
| **Sponsor** | Via franchise admin | Fund contest prize pools, branding on contest cards |
| **AI Agent** | Autonomous | Auto-predict, auto-build squads, auto-join contests |

---

## Smart Contracts

All deployed on WireFluid Testnet. 9 contracts, 3,261 lines of Solidity.

### Contract Addresses

```json
{
  "franchiseRegistry": "0x2e0aaEB43D3E0C331d057052cF768d51B26e2a0B",
  "matchOracle":       "0xdFF4e73cc0493EcDD2d18183223DBc4435D86404",
  "agentRegistry":     "0x3aD3Fd642e062fAf5948DF6DA0614E97824F6A38",
  "reputationStore":   "0x6CB27a8594Ea5A01aB2F4CE5C4225D4BdF04BA20",
  "policyEngine":      "0xc5aA8cbB3c7D6AeFf7EaD29E96eD8c6Ea93d0149",
  "executionGateway":  "0x620901f2AE286ff1c18dFc1751f2f4a5c0d1a2fB",
  "fantasyModule":     "0xe9571F7C8b4a4672bE2C7416c24B21EA045C3A1f",
  "predictionModule":  "0x8aFaf4d20F9707375A53D7EcED61129a6eE9480A",
  "wireTrustNFT":      "0x1F0bFa8Eda8f1dfc09ea8fa8885a2F5d1Cc4bf43",
  "deployer":          "0x22EfFAe93649A93F7c6e01aBB6Ce2496BB2D4105",
  "chainId":           "92533",
  "network":           "wirefluid",
  "deployedAt":        "2026-03-21T23:55:02.837Z"
}
```

### Contract Dependency Graph

```
                    ┌──────────────────┐
                    │ FranchiseRegistry│
                    └────────┬─────────┘
                             │ referenced by
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │AgentRegistry │ │PredictionModule│ │FantasyModule │
    └───────┬──────┘ └──────────────┘ └──────────────┘
            │                                  │
            ▼                                  │
    ┌──────────────┐                           │
    │ PolicyEngine │                           │
    └───────┬──────┘                           │
            │                                  │
            ▼                                  │
    ┌──────────────────┐                       │
    │ExecutionGateway  │◄──────────────────────┘
    │ (central hub)    │
    └───────┬──────────┘
            │
            ▼
    ┌──────────────┐    ┌──────────────┐
    │ReputationStore│    │ MatchOracle  │
    └──────────────┘    └──────────────┘
```

### Core Contracts

#### FranchiseRegistry
Multi-league franchise onboarding. One admin per franchise, enforced on-chain.

| Function | Access | Description |
|----------|--------|-------------|
| `registerFranchise(name, league, admin, treasury)` | Owner | Register franchise → franchiseId |
| `updateFranchise(id, name, league, admin, treasury)` | Owner | Update franchise details |
| `deactivateFranchise(id)` | Owner | Deactivate franchise |
| `setProtocolTreasury(address)` | Owner | Set protocol treasury |
| `getFranchise(id)` | Public | Get franchise details |

#### AgentRegistry
Fan-agent identity and lifecycle management, franchise-scoped.

| Function | Access | Description |
|----------|--------|-------------|
| `createAgent(name, botType, franchiseId)` | Public | Create agent (caller = owner) |
| `deactivateAgent(agentId)` | Agent Owner | Deactivate agent |
| `reactivateAgent(agentId)` | Agent Owner | Reactivate (franchise must be active) |
| `getAgent(agentId)` | Public | Full agent details |
| `getAgentOwnerAndStatus(agentId)` | Public | Lightweight (avoids string copies, saves 2-5k gas) |
| `getAgentsByOwner(owner)` | Public | List user's agent IDs |

#### ReputationStore
On-chain behavioral scoring. Score 0-100 with risk badges.

**Scoring Formula:**
```
base = (successCount × 100) / totalInteractions
violationPenalty = min(attemptedViolations × 3, 30)
failurePenalty = min(failureCount × 2, 20)
recencyPenalty = 10 if violation within 1 hour
score = clamp(base - totalPenalty, 0, 100)
```

**Risk Badges:**
- **SAFE** (score >= 70 AND 0 violations)
- **MEDIUM** (everything else)
- **RISKY** (score < 40 OR violations > 5)

**Gas Optimization:** BehaviorCheckpoint packed into 3 storage slots (down from 8).

#### PolicyEngine
8-check sequential validation engine. Policies are permanent once deployed.

**Policy Struct (packed to 2 value slots):**
```
maxAmountPerAction (uint128) │ maxAmountPerDay (uint128)     ← slot 1
frequencyLimit (uint32) │ expiry (uint48) │                  ← slot 2
maxActivePositions (uint32) │ active (bool)
allowedContracts[] │ allowedActions[]                        ← dynamic
```

**8 Validation Checks (in order):**
1. Policy active
2. Policy not expired
3. Target in allowed contracts whitelist
4. Action in allowed actions whitelist
5. Per-action amount limit
6. Daily cumulative limit (resets at UTC midnight)
7. Frequency cooldown between executions
8. Max active positions not reached

#### ExecutionGateway
Central routing for ALL agent actions. Protected by `ReentrancyGuard`.

**Execution Flow:**
```
1. Validate msg.value == amount
2. Check msg.sender == agent owner
3. Check agent active
4. Check target not forbidden (registry, policy, reputation, self)
5. Compute + consume nonce (keccak256 via inline assembly)
6. Validate against PolicyEngine (8 checks)
7. If rejected: record violation, refund ETH, return false
8. If passed: collect 1% fee → forward call → record reputation
```

**Critical Design:** Nonce consumed BEFORE policy validation. Prevents replay of rejected actions.

### Module Contracts

#### PredictionModule
Points-only fan predictions. Zero staking, halal-compliant.

**Points Formula:**
```
Correct: base(100) + streakBonus(min(streak × 25, 200)) + earlyBird(50 if 1hr before)
Incorrect: 0 points, streak reset
```

Streak milestones at 3, 5, 10, 25 emit `StreakAchieved` event.

#### FantasyModule
Free-to-play with sponsor-funded prizes. Protected by `ReentrancyGuard`.

**Squad Rules:** 11 players, max 100 credits, Captain 2x, Vice-Captain 1.5x.
**Prize Distribution:** Pull pattern (winner claims). 2% protocol fee deducted.

#### WireTrustNFT
5-category NFT system with anti-scalping enforcement.

| Category | Resale Cap | Max Transfers | Soulbound |
|----------|-----------|---------------|-----------|
| TICKET | 110% face | 1 | No |
| EXPERIENCE | 110% face | 1 | No |
| COLLECTIBLE | Unlimited | Unlimited | No |
| BADGE | N/A | 0 | **Yes** |
| MERCHANDISE | Unlimited | Unlimited | No |

**Single Transfer Chokepoint:** All transfer rules enforced in `_update()` override.

#### MatchOracle
Thin settlement oracle. Multi-oracle pattern (multiple authorized wallets).
Contracts function without oracle. Oracle only triggers payouts.

---

## 6-Factor Cricket Intelligence Engine

Located in `backend/services/cricketIntelligence.js`. Pure math with no ML libraries and no external APIs. All computed from 90 historical matches + 157 players in PostgreSQL.

### Factor Weights (MATCH_WINNER)

```
┌────────────────────────────────────────────────┐
│         6-FACTOR COMPOSITE MODEL               │
│                                                │
│  ┌──────────────┐  25%   ELO Power Rankings    │
│  │████████████░░│        (base 1500, K=32)     │
│  └──────────────┘                              │
│  ┌──────────────┐  20%   EWMA Player Form      │
│  │████████░░░░░░│        (decay=0.3)           │
│  └──────────────┘                              │
│  ┌──────────────┐  15%   Head-to-Head Records   │
│  │██████░░░░░░░░│        (last 5 meetings)     │
│  └──────────────┘                              │
│  ┌──────────────┐  15%   Team Momentum          │
│  │██████░░░░░░░░│        (weighted last 8)     │
│  └──────────────┘                              │
│  ┌──────────────┐  15%   Venue Analysis         │
│  │██████░░░░░░░░│        (ground-specific)     │
│  └──────────────┘                              │
│  ┌──────────────┐  10%   Role-Weighted Form     │
│  │████░░░░░░░░░░│        (bat vs bowl split)   │
│  └──────────────┘                              │
│                                                │
│  + Toss Impact (venue-specific)                │
│  + Player-vs-Team Matchups (captain selection)  │
└────────────────────────────────────────────────┘
```

### Functions (13 exported)

| Function | Returns | Description |
|----------|---------|-------------|
| `calculateTeamElos(db)` | `{team: {elo, wins, losses, matches}}` | Process all completed matches chronologically |
| `getPlayerForms(db)` | `Map<playerId, {ewma, trend, consistency, peak}>` | EWMA form for every player |
| `getHeadToHead(db, team1, team2)` | `{team1Wins, team2Wins, totalMatches, recentResults, reasoning}` | Historical matchup dominance |
| `getMomentumScore(db, teamName)` | `{momentum (0-100), streak, trajectory, reasoning}` | Weighted recent form (last 8 matches) |
| `analyzeVenue(db, venue, team1, team2)` | `{venueAvgRuns, team1VenueWinRate, highScoringVenue, reasoning}` | Ground-specific performance |
| `getTossImpact(db, venue)` | `{chasingAdvantage, chasingWinRate, venueType, reasoning}` | Batting-first vs chasing analysis |
| `getRoleWeightedForm(db, team1, team2)` | `{team1BatForm, team1BowlForm, team2BatForm, reasoning}` | Batting vs bowling form split |
| `getPlayerVsTeamBatch(db, playerIds, opponent)` | `Map<playerId, {avgRuns, avgFP, matches}>` | Player performance vs specific team |
| `analyzeMatch(db, team1, team2, venue)` | Full 6-factor analysis object | **Main entry point** for composite prediction |
| `getTeamRecord(db, team)` | `{wins, losses, matches}` | Team W-L record |
| `expectedWinProb(eloA, eloB)` | `number` | ELO win probability formula |
| `updateElo(winner, loser, K=32)` | `{newWinner, newLoser}` | ELO update after match |
| `calculateEWMA(values, decay=0.3)` | `number` | Exponential weighted moving average |

### How `analyzeMatch()` Works

```
Input: team1, team2, venue
  │
  ├─► calculateTeamElos()        → ELO ratings + win probabilities
  ├─► getPlayerForms()           → EWMA form scores per player
  ├─► getHeadToHead()            → H2H records + recent trend
  ├─► getMomentumScore() × 2     → Momentum for each team
  ├─► analyzeVenue()             → Venue-specific performance
  ├─► getTossImpact()            → Toss advantage analysis
  ├─► getRoleWeightedForm()      → Batting vs bowling form split
  └─► getPlayerVsTeamBatch()     → Player matchup data
  │
  ▼
Normalize each factor to 0-1 (team1 perspective):
  elo:          winProb1
  form:         team1FormAvg / (team1FormAvg + team2FormAvg)
  h2h:          team1H2HRate
  momentum:     mom1 / (mom1 + mom2)
  venue:        team1VenueWinRate / 100
  roleWeighted: team1Weighted / (team1Weighted + team2Weighted)
  │
  ▼
Composite = elo×0.25 + form×0.20 + h2h×0.15 + momentum×0.15 + venue×0.15 + role×0.10
  │
  ▼
If factor has <3 data points → redistribute weight to ELO + form
  │
  ▼
Output: predictedWinner, confidence (%), factorScores, reasoning string
```

### Prediction Types

| Type | Logic | Example Reasoning |
|------|-------|-------------------|
| **MATCH_WINNER** | 6-factor composite | "ELO: Lahore 1532 vs Islamabad 1488. H2H 7-5. Momentum 78 vs 62. 6-Factor composite: 68% for Lahore." |
| **TOP_SCORER** | EWMA form + player-vs-team matchup | "Babar Azam: EWMA 42.3 FP, rising trend, 85% consistency. vs Islamabad: 48.1 avg FP in 5 matches." |
| **TOTAL_RUNS** | venueAvg×0.35 + combinedForm×0.35 + roleBat×0.30 | "Gaddafi Stadium: avg 172 runs, high-scoring. Combined EWMA: 312.5. Calling OVER_180." |

---

## AI Agent System

WireTrust has two distinct agent systems: **Fan Agents** (achievement-locked) and **Franchise AI Agents** (ML-powered).

### Fan Agents (Achievement-Locked)

Fans unlock the ability to deploy 1 personal AI agent after reaching milestones:

| Milestone | Requirement |
|-----------|-------------|
| Predictions | 5+ made |
| Squad Challenge | 1+ joined |
| Points | 100+ earned |

Once unlocked, fans can Quick Deploy one of 3 templates (Prediction Bot, Squad Builder, Multi Agent) or manually configure via PolicyBuilder.

Agent lifecycle: `PERCEIVE → REASON → ACT` via ExecutionGateway with 8 on-chain policy checks.

### Franchise AI Agents (ML-Powered)

Franchise admins deploy autonomous intelligence agents from the Franchise Portal (`/franchise/agents`).

**3 Agent Types:**

| Agent | Purpose | Interval |
|-------|---------|----------|
| Opposition Scout | Monitors rival teams for form changes, momentum shifts, player breakouts | 30 min |
| Squad Form Monitor | Tracks squad players via ML regression, alerts on anomalies | 15 min |
| Match Preparation | Auto-generates scouting reports using Random Forest predictions | 60 min |

**ML Engine (`backend/services/mlEngine.js`):**

| Algorithm | Type | Description |
|-----------|------|-------------|
| Match Prediction | Random Forest (200 trees) | 80/20 chronological train/test split. 6 features: ELO diff, form diff, H2H rate, momentum diff, venue win rate, role-weighted form. Reports held-out test accuracy. |
| Player Forecasting | Weighted Linear Regression | Exponential decay (0.85) on match history. Predicts next-match fantasy points with 95% confidence intervals. Confidence adjusted for R-squared and sample size. |
| Squad Optimizer | Constrained Knapsack | Maximizes ML-predicted fantasy points within 100-credit budget. Role constraints (1 WK, 3 BAT, 3 BOWL, 1 ALL). Auto-selects captain/VC. |
| Anomaly Detection | Z-Score Analysis | Rolling window z-score. BREAKOUT (z > 2.0), COLLAPSE (z < -2.0), with percentile ranking via normal CDF approximation. |

**Performance:** All DB queries batched into 4 queries via `loadBatchData()`. ELO, records, momentum, H2H calculated in-memory. Model pre-trained on server startup.

**Security:** Franchise-scoped auth (one franchise cannot view/stop another's agents). Agent IDs generated server-side. Type validated against enum. Reports cleaned up on agent stop.

---

## Backend API

Base URL: `http://localhost:3001/api`

### Health & Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | System status, block number, contract addresses, stats |
| POST | `/auth/create-wallet` | Generate new wallet + fund 0.1 WIRE |
| POST | `/auth/register` | Register wallet address |
| GET | `/auth/balance/:address` | Get WIRE balance |

### Matches & Players

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/matches/live` | Current live match state |
| GET | `/matches/schedule` | All matches |
| GET | `/matches` | All matches (alternate) |
| GET | `/matches/players` | All active players |
| GET | `/matches/players/:matchId` | Players assigned to match |
| POST | `/matches/simulate` | Simulate match result + stats |

### Predictions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/predictions/leaderboard?limit=20` | Top predictors (max 50) |
| GET | `/predictions/match/:matchId` | Predictions for match |
| GET | `/predictions/user/:address` | User's predictions + stats |
| GET | `/predictions/:id` | Single prediction |

### Fantasy

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/fantasy/contests/:matchId` | Contests for a match (includes sponsor branding) |
| GET | `/fantasy/all-contests` | All contests (includes sponsor branding) |
| GET | `/fantasy/my-squads/:address` | User's squads across all contests |
| GET | `/fantasy/leaderboard/:contestId` | Contest rankings |
| GET | `/fantasy/squad/:contestId/:address` | Single squad |
| POST | `/fantasy/create-contest` | Create contest |
| POST | `/fantasy/fund-contest` | Fund prize pool |

**Sponsor Branding:** Contests now include `sponsor`, `sponsorLogo`, `bannerUrl` from `contest_sponsors` table.

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/agents/leaderboard` | Top agents by reputation |
| GET | `/agents/logs/:agentId` | Execution logs |
| GET | `/agents/owner/:address` | User's agent IDs |
| GET | `/agents/reputation/:agentId` | Reputation metrics |
| GET | `/agents/:id` | Agent profile + reputation |
| POST | `/agents/simulate` | Dry-run policy validation |

### Agent Automation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/agents/auto/:id/start` | Start autonomous mode |
| POST | `/agents/auto/:id/stop` | Stop autonomous mode |
| GET | `/agents/auto/:id/status` | Status + logs + thinking steps |
| GET | `/agents/auto/running` | All running agents |

### NFTs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/nfts/verify/:tokenId` | Verify NFT authenticity |
| GET | `/nfts/owned/:address` | User's NFT collection |
| GET | `/nfts/:tokenId` | NFT metadata |

### Challenges

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/challenges/:franchiseId` | Active challenges (with user progress if ?address=) |
| POST | `/challenges/claim` | Claim challenge reward NFT |

### Admin Portal

All endpoints require `x-wallet-address` header matching the deployer address.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/stats` | Platform-wide statistics |
| GET | `/admin/franchises` | All franchises |
| GET | `/admin/matches?page=&limit=` | Paginated matches |
| POST | `/admin/matches` | Create/update match |
| DELETE | `/admin/matches/:matchId` | Delete match |
| GET | `/admin/players?page=&limit=&search=` | Paginated players |
| POST | `/admin/players` | Create/update player |
| DELETE | `/admin/players/:playerId` | Delete player |
| POST | `/admin/match-players` | Assign players to match |
| GET | `/admin/challenges?page=&limit=` | Paginated challenges |
| POST | `/admin/challenges` | Create challenge |
| DELETE | `/admin/challenges/:id` | Deactivate challenge |
| GET | `/admin/users?page=&limit=&search=` | Paginated users |
| GET | `/admin/faucet-history?page=&limit=` | Faucet history |
| POST | `/admin/oracle/submit-result` | Submit match result to oracle |
| POST | `/admin/oracle/submit-player-stats` | Submit player performance |
| POST | `/admin/live-match` | Update live match state |
| GET | `/admin/treasury` | Protocol + franchise treasuries |
| POST | `/admin/contests/create` | Create fantasy contest |
| POST | `/admin/contests/fund` | Fund contest |
| POST | `/admin/predictions/resolve` | Resolve single prediction |
| POST | `/admin/predictions/resolve-match` | Batch resolve by match |
| POST | `/admin/predictions/cancel-match` | Cancel abandoned match |
| POST | `/admin/fantasy/lock/:contestId` | Lock contest entries |
| POST | `/admin/fantasy/update-scores` | Update player fantasy points |
| POST | `/admin/fantasy/finalize/:contestId` | Finalize contest |
| POST | `/admin/settle-match/:matchId` | **One-click settlement** |

### Franchise Portal

All endpoints require `x-wallet-address` header. Data scoped to franchise.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/franchise-portal/info` | Franchise details |
| GET | `/franchise-portal/stats` | Franchise statistics |
| GET | `/franchise-portal/fan-stats` | Fan engagement metrics |
| GET | `/franchise-portal/analytics` | **6-factor intelligence analytics** (ELO, H2H, venue, momentum) |
| GET | `/franchise-portal/matches?page=&limit=` | Franchise matches |
| POST | `/franchise-portal/matches` | Create match |
| DELETE | `/franchise-portal/matches/:matchId` | Delete match |
| GET | `/franchise-portal/players?page=&limit=` | Franchise players (scoped) |
| POST | `/franchise-portal/players` | Create player |
| DELETE | `/franchise-portal/players/:playerId` | Delete player |
| POST | `/franchise-portal/match-players` | Assign players |
| GET | `/franchise-portal/challenges?page=&limit=` | Franchise challenges |
| POST | `/franchise-portal/challenges` | Create challenge |
| DELETE | `/franchise-portal/challenges/:id` | Deactivate challenge |
| POST | `/franchise-portal/live-match` | Update live state |
| POST | `/franchise-portal/contests/create` | Create contest (with sponsor branding) |
| POST | `/franchise-portal/contests/fund` | Fund contest |
| POST | `/franchise-portal/predictions/resolve-match` | Resolve predictions |
| POST | `/franchise-portal/fantasy/finalize/:contestId` | Finalize contest |
| POST | `/franchise-portal/settle-match/:matchId` | One-click settlement |

**Analytics Response** (`/franchise-portal/analytics`):
```json
{
  "eloRankings": [
    { "team": "Lahore Qalandars", "elo": 1548, "wins": 18, "losses": 9,
      "matchesPlayed": 29, "winRate": "62.1%" }
  ],
  "playerForm": [
    { "name": "Babar Azam", "team": "Peshawar Zalmi", "ewma": 42.3,
      "trend": "rising", "consistency": 85, "role": "BAT" }
  ],
  "venueBreakdown": [...],
  "h2hRecords": [...],
  "momentumData": { "momentum": 78, "streak": "WWWL", "trajectory": "rising" }
}
```

---

## Frontend & Redux Store

### Redux Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Redux Store                       │
│                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ walletSlice  │  │ agentSlice  │  │ matchSlice  │ │
│  │             │  │             │  │             │ │
│  │ address     │  │ list[]      │  │ all[]       │ │
│  │ balance     │  │ profiles{}  │  │ live[]      │ │
│  │ chainId     │  │ leaderboard│  │ loading     │ │
│  │ walletType  │  │ loading    │  │ error       │ │
│  │ connected   │  │ error      │  │             │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│  ┌─────────────┐                                     │
│  │fantasySlice │   Synced from WalletContext          │
│  │             │   via useDispatch on state change    │
│  │ contests[]  │                                     │
│  │ predictions│                                     │
│  │ loading    │                                     │
│  └─────────────┘                                     │
└─────────────────────────────────────────────────────┘
```

**Data Flow:**
1. Dashboard preloads `fetchMatches()` + `fetchContests()` into Redux on mount
2. When user navigates to Predictions or Fantasy, data is already cached
3. Agent profiles cached by ID so navigating back is instant
4. WalletContext auto-syncs to Redux on every wallet state change

**Async Thunks:**
- `fetchAgents(ownerAddress)` - Load user's agent IDs
- `fetchAgentProfile(agentId)` - Load + cache agent profile
- `fetchLeaderboard()` - Load agent leaderboard
- `fetchMatches()` - Load all matches
- `fetchLiveMatches()` - Load live match data
- `fetchContests()` - Load all open contests
- `fetchPredictions(address)` - Load user's predictions

### Public Pages (12)

| Route | Component | Redux Actions | Description |
|-------|-----------|---------------|-------------|
| `/` | Dashboard | `fetchMatches`, `fetchContests`, `fetchLiveMatches` | Main hub with live match banner, stats, quick actions |
| `/welcome` | Onboarding | -| Wallet connection and new user setup |
| `/predict` | Predictions | `fetchMatches`, `fetchPredictions` | Make predictions, view leaderboard, track results |
| `/squad-challenge` | Fantasy | `fetchContests` | Browse contests, build squads, sponsor branding |
| `/marketplace` | Marketplace | -| NFT marketplace (tickets, badges, collectibles) |
| `/learn` | Learn | -| Educational content |
| `/fan/:address` | FanProfile | -| User profile with stats and earning summary |
| `/agents` | AgentsHub | `fetchLeaderboard`, `fetchAgents` | Agent dashboard, leaderboard, running agents |
| `/create-agent` | CreateAgent | -| Create autonomous AI agent |
| `/agent/:agentId` | AgentProfile | `fetchAgentProfile` | Agent details, reputation, autonomous mode controls |
| `/policy/:agentId` | PolicyBuilder | -| Build policies (**locks permanently** after deploy) |
| `/execute/:agentId` | ExecuteAction | -| Manual agent action execution |

### Admin Pages (9)

| Route | Component | Description |
|-------|-----------|-------------|
| `/admin` | AdminDashboard | Platform stats, contract addresses, treasury |
| `/admin/franchises` | AdminFranchises | Manage all franchises |
| `/admin/matches` | AdminMatches | CRUD matches, assign players |
| `/admin/players` | AdminPlayers | Manage player roster |
| `/admin/challenges` | AdminChallenges | Create fan challenges |
| `/admin/users` | AdminUsers | View users, faucet history |
| `/admin/oracle` | AdminOracle | Submit match results + player stats |
| `/admin/settlement` | AdminSettlement | One-click settle, contests, treasury |

### Franchise Pages (8)

| Route | Component | Description |
|-------|-----------|-------------|
| `/franchise` | FranchiseDashboard | Franchise stats overview |
| `/franchise/matches` | FranchiseMatches | Manage franchise matches |
| `/franchise/players` | FranchisePlayers | Manage franchise players (scoped) |
| `/franchise/challenges` | FranchiseChallenges | Manage challenges |
| `/franchise/live` | FranchiseLive | Live match score updates |
| `/franchise/contests` | FranchiseContests | Create contests **with sponsor branding** |
| `/franchise/analytics` | FranchiseAnalytics | **6-factor intelligence dashboard** (ELO, H2H, venue, momentum, player form) |

### Context Providers

**WalletContext** - Global wallet state (auto-syncs to Redux):
- `address`, `signer`, `provider`, `balance`, `connected`, `chainId`, `walletType`
- `connectGoogle()` - Web3Auth social login
- `connectMetaMask()` - MetaMask connection
- `disconnect()` - Disconnect wallet
- `refreshBalance()` - Refresh WIRE balance

**ToastContext** - Notification system:
- `success(msg)`, `error(msg)`, `warning(msg)`, `info(msg)`

---

## Database Schema

### Tables (11)

#### `users`
| Column | Type | Description |
|--------|------|-------------|
| address | VARCHAR(42) PK | Wallet address |
| wallet_type | VARCHAR(20) | 'metamask' or 'web3auth' |
| funded | BOOLEAN | Has received faucet funds |
| created_at | TIMESTAMP | Registration time |

#### `matches`
| Column | Type | Description |
|--------|------|-------------|
| match_id | INTEGER PK | Unique match ID |
| franchise_id | INTEGER | Owning franchise |
| team1 | VARCHAR | Team 1 name |
| team2 | VARCHAR | Team 2 name |
| venue | VARCHAR | Match venue |
| start_time | TIMESTAMP | Scheduled start |
| status | VARCHAR | UPCOMING / LIVE / COMPLETED / ABANDONED |
| result | VARCHAR | Winning team or null |

**Current data:** 134 matches (44 PSL 2026 + 90 historical)

#### `players`
| Column | Type | Description |
|--------|------|-------------|
| player_id | INTEGER PK | Unique player ID |
| name | VARCHAR | Player name |
| team | VARCHAR | Team name |
| role | VARCHAR | BAT / BOWL / ALL / WK |
| credits | NUMERIC(5,1) | Fantasy credit value |
| image_url | VARCHAR | Player photo URL |
| active | BOOLEAN | Currently active |

**Current data:** 157 players across 8 PSL teams.

#### `match_players`
| Column | Type | Description |
|--------|------|-------------|
| match_id | INTEGER | FK to matches |
| player_id | INTEGER | FK to players |
| fantasy_points | INTEGER | Points scored (post-settlement) |

#### `player_match_stats`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment |
| match_id | INTEGER | FK to matches |
| player_id | INTEGER | FK to players |
| runs | INTEGER | Runs scored |
| wickets | INTEGER | Wickets taken |
| catches | INTEGER | Catches taken |
| economy | NUMERIC | Economy rate |
| strike_rate | NUMERIC | Strike rate |
| fantasy_points | NUMERIC | Fantasy points earned |

Used by the 6-factor intelligence engine for EWMA form tracking.

#### `challenges`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment |
| franchise_id | INTEGER | Owning franchise |
| name | VARCHAR | Challenge name |
| description | TEXT | Challenge description |
| category | VARCHAR | TICKET / EXPERIENCE / COLLECTIBLE / BADGE / MERCHANDISE |
| condition_type | INTEGER | On-chain condition type |
| condition_target | INTEGER | Target value |
| reward_name | VARCHAR | NFT reward name |
| reward_description | TEXT | NFT description |
| reward_category | INTEGER | NFT category (0-4) |
| reward_face_price | INTEGER | NFT face value |
| max_claims | INTEGER | Max times claimable |
| expires_at | TIMESTAMP | Expiration date |
| active | BOOLEAN | Currently active |

#### `challenge_claims`
| Column | Type | Description |
|--------|------|-------------|
| challenge_id | INTEGER | FK to challenges |
| address | VARCHAR(42) | Claimer's wallet |
| token_id | INTEGER | Minted NFT token ID |
| tx_hash | VARCHAR | Blockchain TX hash |
| claimed_at | TIMESTAMP | Claim time |

#### `faucet_history`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment |
| address | VARCHAR(42) | Funded wallet |
| amount | NUMERIC | WIRE sent |
| tx_hash | VARCHAR | TX hash |
| funded_at | TIMESTAMP | Time |

#### `live_match_state`
| Column | Type | Description |
|--------|------|-------------|
| match_id | INTEGER PK | FK to matches |
| team1/team2 | VARCHAR | Team names |
| innings | INTEGER | Current innings (1 or 2) |
| overs | VARCHAR | Current overs (e.g. "12.3") |
| score | VARCHAR | Current score (e.g. "145/3") |
| batting/bowling | VARCHAR | Current batting/bowling teams |
| current_batsman | VARCHAR | Batsman on strike |
| current_bowler | VARCHAR | Current bowler |
| run_rate | VARCHAR | Current run rate |

#### `contest_sponsors`
| Column | Type | Description |
|--------|------|-------------|
| contest_id | INTEGER PK | FK to contest |
| sponsor_name | VARCHAR(200) | Sponsor name |
| sponsor_logo | VARCHAR(500) | Logo URL |
| banner_url | VARCHAR(500) | Banner image URL |
| created_at | TIMESTAMP | Created time |

Franchise admins set sponsor branding when creating contests. Fans see sponsor name, logo and banner on contest cards.

#### `agent_decisions`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment |
| agent_id | INTEGER | Agent ID |
| match_id | INTEGER | Match analyzed |
| decision_type | VARCHAR | PREDICTION / FANTASY |
| outcome | VARCHAR | Predicted outcome |
| confidence | INTEGER | Confidence % |
| reasoning | TEXT | Full reasoning string |
| executed | BOOLEAN | Successfully executed on-chain |
| created_at | TIMESTAMP | Decision time |

---

## Historical PSL Data

### Seeded via `backend/db/seedPSLHistory.js`

90 real match results from ESPNcricinfo across 3 PSL seasons:

| Season | Match IDs | Dates | Champion |
|--------|-----------|-------|----------|
| PSL 8 (2022/23) | 100-129 | Feb-Mar 2023 | Lahore Qalandars |
| PSL 9 (2023/24) | 130-159 | Feb-Mar 2024 | Islamabad United |
| PSL 10 (2025) | 160-189 | Apr-May 2025 | Quetta Gladiators |

### All-Time Team Records (PSL 8 + 9 + 10)

| Team | W | L | NR | Win Rate |
|------|---|---|----|----|
| Lahore Qalandars | 18 | 9 | 2 | 62% |
| Multan Sultans | 17 | 12 | 1 | 57% |
| Islamabad United | 17 | 12 | 1 | 57% |
| Quetta Gladiators | 14 | 14 | 2 | 47% |
| Peshawar Zalmi | 11 | 20 | 0 | 35% |
| Karachi Kings | 10 | 20 | 0 | 33% |

### PSL 2026 Teams (Current Season)

| Team | Status | Matches |
|------|--------|---------|
| Islamabad United | Established | 10 |
| Lahore Qalandars | Established | 10 |
| Multan Sultans | Established | 10 |
| Peshawar Zalmi | Established | 10 |
| Quetta Gladiators | Established | 10 |
| Karachi Kings | Established | 10 |
| Rawalpindiz | **NEW franchise** (owned by Walee Technologies) | 10 |
| Hyderabad Kingsmen | **NEW franchise** | 10 |

**Note:** Rawalpindiz and Hyderabad Kingsmen are new PSL 2026 franchises with 0 historical data. The ELO engine assigns them base rating 1500.

---

## User Flows

### Flow 1: Fan Earning Journey

```
1. Connect Wallet (MetaMask or Web3Auth social login)
        ↓
2. Receive 0.1 WIRE from faucet (auto-funded on registration)
        ↓
3. Make FREE Predictions
   ├── Pick match winner, top scorer, total runs
   ├── Earn 100 base points for correct predictions
   ├── Streak bonus: +25 per consecutive correct (max +200)
   └── Early bird bonus: +50 if submitted 1hr+ before match
        ↓
4. Join FREE Fantasy Contests
   ├── Build 11-player squad (Captain 2x, Vice-Captain 1.5x)
   ├── See sponsor branding (logo, banner) on contest cards
   ├── Sponsor-funded prize pools (no cost to fans)
   └── Win WIRE tokens from prize pool
        ↓
5. Complete Challenges → Earn NFTs
   ├── "Make 5 predictions" → Badge NFT (soulbound)
   ├── "Attend match" → Ticket NFT
   └── "Join 3 contests" → Collectible NFT
        ↓
6. Deploy AI Agent (optional, advanced)
   ├── Agent uses 6-factor intelligence to auto-predict
   ├── Set policies (allowed actions, cooldowns, expiry)
   ├── Policy locks permanently on-chain after deploy
   └── Agent earns/loses reputation based on performance
```

### Flow 2: Franchise Admin

```
1. Connect franchise admin wallet
        ↓
2. Dashboard: franchise stats (matches, players, challenges, fans)
        ↓
3. Manage Matches + Players
   ├── Create matches with teams, venue, schedule
   ├── Assign players to matches
   └── Update live match state during games
        ↓
4. Create Challenges with NFT Rewards
        ↓
5. Run Sponsor-Branded Contests
   ├── Set sponsor name, logo URL, banner image
   ├── Fund prize pools (or get sponsors to fund)
   └── One-click settle matches after completion
        ↓
6. View 6-Factor Analytics
   ├── ELO power rankings across all PSL teams
   ├── Venue performance breakdown
   ├── Head-to-head records vs opponents
   ├── Team momentum scores (0-100)
   └── Player form table (EWMA, trend, consistency)
```

### Flow 3: Match Settlement Pipeline

```
Match Completes
        ↓
Step 1: Submit result to MatchOracle
        └── POST /admin/oracle/submit-result { matchId, winner, abandoned }
        ↓
Step 2: Submit player stats to oracle
        └── POST /admin/oracle/submit-player-stats { matchId, playerId, runs, ... }
        ↓
Step 3: Resolve predictions
        └── POST /admin/predictions/resolve-match { matchId, type, outcome }
        ↓
Step 4: Update fantasy scores + lock + finalize contest
        └── POST /admin/fantasy/update-scores → lock → finalize
        ↓
Step 5: Prize pool distributed (minus 2% fee)

One-click shortcut: POST /admin/settle-match/:matchId (runs all steps)
```

---

## Cron Jobs & Automation

### Sportmonks Match Sync (`backend/services/matchSync.js`)

| Job | Interval | Description |
|-----|----------|-------------|
| `syncSchedule()` | Every 24 hours | Fetch fixtures → upsert matches + players to DB |
| `checkLiveMatches()` | Every 5 minutes | Check live scores → update state → trigger auto-settlement |

### AI Agent Runner (`backend/services/agentRunner.js`)

| Config | Default | Description |
|--------|---------|-------------|
| `intervalSeconds` | 60 | Cycle interval |
| `maxActionsPerCycle` | 3 | Max on-chain actions per cycle |
| `predictionTypes` | MATCH_WINNER, TOP_SCORER | What to predict |
| `botType` | PREDICTION | Agent type |

**Match Discovery Fallback:** If MatchOracle returns 0 unresolved fixtures, agent queries PostgreSQL directly for UPCOMING/LIVE/COMPLETED matches.

---

## Configuration

### Backend (`.env`)
```env
# Blockchain
PRIVATE_KEY=0x...                    # Deployer/signer private key
RPC_URL=https://evm.wirefluid.com   # WireFluid RPC
WSS_URL=wss://ws.wirefluid.com      # WebSocket endpoint
CHAIN_ID=92533

# Database
DATABASE_URL=postgres://user:pass@host:5432/wiretrust

# Cricket API
SPORTMONKS_KEY=<your_api_token>
SPORTMONKS_LEAGUE_ID=3               # T20I (free tier)

# Features
AUTO_SETTLE=true                     # Auto-settlement on match completion
```

### Frontend (`.env`)
```env
VITE_WEB3AUTH_CLIENT_ID=<your_client_id>
VITE_API_BASE_URL=                   # Empty = use proxy, or set to http://localhost:3001
```

---

## Revenue Model

Three on-chain fee streams. All protocol-level and fully transparent.

| Revenue Stream | Fee | Source | Destination |
|---------------|-----|--------|-------------|
| Agent Execution Fee | **1%** | Every agent execution via ExecutionGateway | Protocol Treasury |
| Fantasy Contest Fee | **2%** | Deducted from sponsor-funded prize pools | Protocol Treasury |
| NFT Resale Fee | **2.5%** | On secondary market NFT transfers | Protocol Treasury |

### Key Principle: Fans Never Pay

- Predictions are **FREE** (earn points, not stakes)
- Fantasy contests are **FREE** to join (sponsor-funded)
- Challenges are **FREE** to complete (earn NFT rewards)
- Revenue comes from sponsors, franchises and NFT secondary market

---

## Security & Audit Notes

### Smart Contract Security

| Protection | Status | Contracts |
|-----------|--------|-----------|
| ReentrancyGuard | Implemented | ExecutionGateway, FantasyModule, WireTrustNFT |
| Pausable (Emergency Stop) | Implemented | ExecutionGateway, FantasyModule, PredictionModule |
| Nonce Replay Protection | Implemented | ExecutionGateway (consumed before external call) |
| Forbidden Targets | Implemented | ExecutionGateway (registry, policy, reputation, self) |
| Fee After Success Only | Implemented | ExecutionGateway (no fee collected on failed execution) |
| Pull Pattern | Implemented | FantasyModule (winner claims prize) |
| Buyer-Initiated NFT Flow | Implemented | WireTrustNFT (listForSale + buyToken, not seller-initiated) |
| Participant Cap | Implemented | FantasyModule (ABSOLUTE_MAX_PARTICIPANTS = 200) |
| Paginated Resolution | Implemented | PredictionModule (startIndex/endIndex to avoid gas limits) |
| Zero Player ID Validation | Implemented | FantasyModule (rejects squads with player ID 0) |
| Event Timestamp Cap | Implemented | WireTrustNFT (MAX_EVENT_HORIZON = 730 days) |
| Past Start Time Rejection | Implemented | MatchOracle (rejects startTime <= block.timestamp) |
| Soulbound Enforcement | Implemented | WireTrustNFT (`_update()` single chokepoint) |
| Anti-Scalping | Implemented | WireTrustNFT (110% resale cap, validated at listing time) |
| Custom Errors | Implemented | All contracts (gas efficient) |
| Storage Packing | Implemented | 3-slot BehaviorCheckpoint, 2-slot Policy |
| Emergency Withdraw | Implemented | FantasyModule (recover stuck contest ETH) |

### Backend Security

| Protection | Status |
|-----------|--------|
| Rate Limiting | 3-tier: strict (5/15min), moderate (30/min), relaxed (100/min) |
| CSRF Protection | X-Requested-With header required on mutations (same-origin only) |
| CORS Restriction | Configurable via CORS_ORIGINS env (not wildcard) |
| Input Validation | Winner string validated against DB teams, agent type against enum |
| Atomic Faucet | INSERT ON CONFLICT prevents race condition double-funding |
| Error Handling | Global error handler + 404 route + no empty catch blocks |
| Franchise Agent Auth | Franchise-scoped (one franchise cannot access another's agents) |

### 203 Passing Tests

| File | Coverage |
|------|----------|
| CoreContracts.test.js | All 5 core contracts (57 tests) |
| Modules.test.js | Predictions, Fantasy, NFTs (77 tests) |
| MatchOracle.test.js | Oracle auth, results, player stats (13 tests) |
| Integration.test.js | End-to-end protocol workflows (12 tests) |
| NewFeatures.test.js | Pausable, buyer NFT, pagination, ML features (30 tests) |

### Gas Optimizations

- `BehaviorCheckpoint` packed into 3 storage slots (from 8)
- Inline assembly for nonce hash computation (50-100 gas saved)
- `getAgentOwnerAndStatus()` avoids string copies (2-5k gas saved)
- O(1) swap-and-pop for NFT owner tracking
- Daily limit bucketing via `(timestamp / 1 days) * 1 days`

### Known Limitations

- **Emergency pause** implemented via OpenZeppelin Pausable on ExecutionGateway, FantasyModule, PredictionModule (owner-only pause/unpause)
- **Single owner** (Ownable, not AccessControl with roles)
- **No timelock** on treasury changes
- **Non-upgradeable** contracts (acceptable for testnet)

---

## Quick Start (Development)

```bash
# 1. Install dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 2. Compile contracts
npx hardhat compile

# 3. Run tests (203 should pass)
npx hardhat test

# 4. Setup database
cd backend
cp .env.example .env     # Fill in DATABASE_URL, PRIVATE_KEY, etc.
node db/migrate.js       # Create tables
node db/seedPSLHistory.js # Seed 90 historical matches
npm start                # Backend on port 3001

# 5. Start frontend
cd ../frontend
cp .env.example .env     # Fill in VITE_WEB3AUTH_CLIENT_ID
npm run dev              # Vite dev server on port 5173
```

## User Journey

| Route | Who | What |
|-------|-----|------|
| `/` | Visitors | Landing page: 4 ways to play, 6-factor intelligence, PSL teams, FAQ |
| `/welcome` | New users | Onboarding: Google Sign-In or MetaMask |
| `/dashboard` | Connected fans | Personal stats, agents, quick actions |
| `/predict` | Fans | Free match predictions (earn points, streaks) |
| `/squad-challenge` | Fans | Free fantasy cricket (sponsor-funded prizes) |
| `/marketplace` | Fans | NFT challenges and rewards |
| `/agents` | Fans (unlocked) | Personal AI agent (after 5 predictions + 1 squad + 100 points) |
| `/franchise/agents` | Franchise admins | ML-powered AI intelligence (Scout, Form Monitor, Match Prep) |
| `/admin` | Super admin | Protocol management |

---

*WireTrust Protocol v2.0.0 - Updated 2026-04-15*
*Built on WireFluid Blockchain (Chain 92533) | 9 Smart Contracts | 203 Tests | 30 Pages | 80+ API Endpoints | Random Forest ML*
