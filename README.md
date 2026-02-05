## Funding Monitor API

A NestJS service that continuously collects **funding rates** from **MEXC** and **Aster**, stores them in **PostgreSQL**, and exposes HTTP endpoint `/arbitrage` for funding arbitrage analysis.

---
## Environment variables

Create a `.env` file in the project root:

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=strongpassword
DB_NAME=funding
DB_PORT=5432

# TypeORM
DB_SYNC=true
DB_LOGGING=false

# Funding collector
FUNDING_POLL_MS=30000

# Exchange endpoints
MEXC_TICKERS_URL=https://www.mexc.com/api/platform/futures/api/v1/contract/ticker
MEXC_FUNDING_BASE=https://contract.mexc.com/api/v1/contract/funding_rate/
ASTER_FUNDING_URL=https://www.asterdex.com/bapi/futures/v1/public/future/common/real-time-funding-rate

# MEXC limits
MEXC_FUNDING_RPS=10
MEXC_BATCH_SIZE=250

# Optional proxy
HTTP_PROXY=http://user:password@host:port
```

## How to run
### Run locally

#### 1. Create `.env`
#### 2. Install dependencies

```bash
npm install
```

#### 3. Run PostgreSQL in Docker (or locally)

```bash
docker compose up --build
```

#### 4. Run App

```bash
npm run start:dev
```

#### 5. Access API

```bash
http://localhost:3000/arbitrage
```

### Query parameters

The `/arbitrage` endpoint accepts the following query parameters.  
All parameters are optional

| Name | Type | Default | Validation | Description |
|----|----|----|----|----|
| `page` | number | `1` | integer ≥ 1 | Page number for pagination |
| `limit` | number | `20` | integer between 1 and 100 | Number of results per page |
| `min` | number | `0` | number ≥ 0 | Minimum daily funding spread (`dailyPct`) |

### Example response

```json
{
  "page": 1,
  "limit": 20,
  "total": 220,
  "data": [
    {
      "symbol": "WHITEWHALEUSDT",
      "long": {
        "exchange": "mexc",
        "fundingPct": -0.7222,
        "intervalHours": 4,
        "fundingTimeMs": "1770292800000",
        "retrievedAtMs": "1770291329466",
        "ageSec": 106
      },
      "short": {
        "exchange": "aster",
        "fundingPct": -0.061658,
        "intervalHours": 1,
        "fundingTimeMs": "1770292800000",
        "retrievedAtMs": "1770291385890",
        "ageSec": 50
      },
      "diffPctPerHour": 0.118892,
      "dailyPct": 2.853408,
      "fundingSkewSec": 0,
      "markPrice": 0.11159998
    },
    {
      "symbol": "PENGUINUSDT",
      "long": {
        "exchange": "aster",
        "fundingPct": -0.065404,
        "intervalHours": 1,
        "fundingTimeMs": "1770292800000",
        "retrievedAtMs": "1770291385890",
        "ageSec": 50
      },
      "short": {
        "exchange": "mexc",
        "fundingPct": -0.0123,
        "intervalHours": 4,
        "fundingTimeMs": "1770292800000",
        "retrievedAtMs": "1770291271971",
        "ageSec": 164
      },
      "diffPctPerHour": 0.062329,
      "dailyPct": 1.495896,
      "fundingSkewSec": 0,
      "markPrice": 0.02158
    }
    // ... more
  ]
}
