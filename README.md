# QueryMesh — FK Dependency Analyzer

<div align="center">

[![GitHub](https://img.shields.io/badge/GitHub-Sahith59%2FQueryMesh-181717?style=flat-square&logo=github)](https://github.com/Sahith59/QueryMesh)
![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-61dafb?style=flat-square&labelColor=555555)
![Backend](https://img.shields.io/badge/Backend-Spring%20Boot%203-6db33f?style=flat-square&labelColor=555555)
![Database](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20MySQL%20%7C%20MariaDB-336791?style=flat-square&labelColor=555555)
![Deployment](https://img.shields.io/badge/Deployment-Docker%20Compose-2496ed?style=flat-square&labelColor=555555)
![License](https://img.shields.io/badge/License-MIT-97ca00?style=flat-square&labelColor=555555)

**A PostgreSQL / MySQL / MariaDB schema visualizer and FK dependency analysis tool for backend engineers and DBAs.**

[Live Demo](http://localhost:3001) · [GitHub](https://github.com/Sahith59/QueryMesh)

</div>

---

QueryMesh connects to your database, introspects the schema, and renders an interactive foreign key dependency graph. Beyond visualization, it scans for referential integrity violations in real time, detects missing indexes on FK columns, finds circular dependencies, and lets you snapshot schema state to detect drift over time.

---

## Features

### Interactive FK Dependency Graph
- Queries `information_schema` to extract all tables, columns, foreign keys, indexes, and row counts
- Automatic hierarchical layout via the dagre algorithm — no manual positioning
- Custom table nodes with row count, column count, index count, and health badges
- Animated edges labeled with constraint names; edges pulse when the source table has violations
- Minimap for large schema navigation; zoom and pan controls

### Real-Time Violation Scanner
- Detects orphaned rows across every FK relationship using LEFT JOIN queries
- Runs async on a background thread; streams progress and results via WebSocket (STOMP)
- Severity levels: **LOW** (1–9 rows), **MEDIUM** (10–99), **HIGH** (100+)
- Each violation card shows orphaned row count, referenced table, and a suggested SQL fix
- Click any card to expand the suggested `DELETE` statement

### Index Gap Analysis
- Finds FK columns with no supporting index — a common source of slow JOIN queries
- Shows estimated row count per unindexed column with severity rating
- One-click copy of `CREATE INDEX` SQL for individual gaps or all gaps at once

### Circular Dependency Detection
- Detects cycles in the FK graph using DFS
- Shows the full cycle path (A → B → C → A) and each constraint involved
- Explains the risk of each cycle (cascading deletes, deadlocks, migration ordering)

### Schema Drift Detection
- Snapshot your schema at any point in time
- Compare two snapshots to see added tables, dropped tables, added/removed columns, and new/removed FK constraints
- Useful for tracking accidental schema changes across environments

### Blast Radius Diagnosis
- BFS traversal from any table to calculate how many tables a schema change would impact
- Shows the full dependency chain, incoming FK list, and outgoing FK list
- Affected tables shown as chips for quick scanning

### Live Database Hot-Swap
- Switch databases without restarting the server via the Tools panel
- Supports PostgreSQL, MySQL, and MariaDB connection strings
- Connection validated before switching; error shown inline if unreachable

### Fullscreen Mode
- Press `F` anywhere in the app (outside an input) to toggle fullscreen
- Or click the expand button in the header

---

## Screenshots

### Dashboard — Full Dependency Graph
<img width="2557" height="1319" alt="image" src="https://github.com/user-attachments/assets/fba50029-6327-44b4-8965-dc19e32d44af" />

### Violation Scanner — Real-Time Results
<img width="394" height="862" alt="image" src="https://github.com/user-attachments/assets/bb76a737-a995-47ae-bd3e-05bfa14ede13" />

### Blast Radius Diagnosis
<img width="2543" height="433" alt="image" src="https://github.com/user-attachments/assets/698c3a18-a88b-41be-be46-ce96820660e6" />

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript, Vite |
| Graph | React Flow (@xyflow/react) + dagre layout |
| Animation | Framer Motion (motion/react v11) |
| HTTP | Axios |
| WebSocket | @stomp/stompjs (STOMP over WS) |
| Routing | React Router DOM v7 |
| Backend | Spring Boot 3.2, Java 17 |
| Database | PostgreSQL 15, MySQL 8, MariaDB 10 |
| Container | Docker + Docker Compose |
| Web Server | nginx (Alpine) |

---

## Getting Started

### Option 1: Docker Compose (Recommended)

```bash
git clone https://github.com/Sahith59/QueryMesh.git
cd QueryMesh
docker compose up --build
```

Open [http://localhost:3001](http://localhost:3001). Allow ~2 minutes for the initial build.

### Option 2: Development Mode

**Terminal 1 — PostgreSQL:**
```bash
docker run -d --name qm-postgres \
  -p 5432:5432 \
  -e POSTGRES_DB=querymesh_demo \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=demo \
  -v $(pwd)/seed.sql:/docker-entrypoint-initdb.d/seed.sql \
  postgres:15
```

**Terminal 2 — Backend:**
```bash
cd backend
./mvnw spring-boot:run
```

**Terminal 3 — Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Architecture

```
Browser (React + React Flow)
    │
    ├── REST (Axios)      → GET /api/schema/graph, /api/schema/diagnose, POST /api/scan/start
    └── WebSocket (STOMP) → /topic/scan-progress, /topic/violations
                                │
                         Spring Boot (Java 17)
                                │
                         PostgreSQL / MySQL / MariaDB
                            information_schema
```

**nginx** in the frontend container proxies `/api/*` and `/ws` to the backend, so the browser only ever talks to one origin.

---

## Project Structure

```
QueryMesh/
├── backend/                          # Spring Boot application
│   ├── pom.xml
│   ├── Dockerfile
│   └── src/main/java/com/querymesh/
│       ├── controller/               # SchemaController, ScanController
│       ├── model/                    # SchemaNode, SchemaEdge, ViolationAlert, etc.
│       └── service/                  # Introspection, Scanner, Diagnostic services
│
├── frontend/                         # React + TypeScript
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── pages/                    # LandingPage, (App as route)
│       ├── components/               # Header, DependencyGraph, ViolationPanel, etc.
│       ├── services/                 # api.ts, websocket.ts
│       └── types/                    # TypeScript interfaces
│
├── seed.sql                          # Demo e-commerce schema with intentional FK violations
├── docker-compose.yml
└── README.md
```

---

## Demo Database

The seed schema is a realistic e-commerce setup with **8 tables** and **10 FK relationships**, with intentional violations for demonstration:

| Table | Violation | Orphaned Rows |
|-------|-----------|--------------|
| order_items | order_id references missing orders | 3 |
| order_items | product_id references missing products | 2 |
| reviews | user_id references missing users | 2 |
| reviews | product_id references missing products | 3 |
| payments | order_id references missing orders | 2 |

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schema/graph` | Full FK graph (nodes + edges) |
| GET | `/api/schema/tables` | All tables with columns, indexes, row counts |
| GET | `/api/schema/violations` | All FK integrity violations |
| POST | `/api/schema/diagnose` | Blast radius for a given table |
| POST | `/api/scan/start` | Trigger async scan (results via WebSocket) |

### WebSocket Topics

| Topic | Event |
|-------|-------|
| `/topic/scan-progress` | `{ currentTable, tablesScanned, totalTables, violationsFound, status }` |
| `/topic/violations` | `{ table, column, orphanedRows, severity, suggestedFix, referencedTable }` |

---

## License

MIT
