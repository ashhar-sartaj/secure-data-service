## Architecture

- **Turborepo**: Orchestrates all 3 workspaces (**web**, **api**, **crypto**)
- **pnpm workspaces**: Enables shared usage of `@repo/crypto` across workspaces

![Architecture Diagram](architecture.jpg)

---

## Monorepo Structure
```bash
secure-transactions-service/
├── turbo.json # Build orchestration
├── pnpm-workspace.yaml # Workspace defined here
├── packages/
│ └── crypto/ # Shared encryption library
└── apps/
├── web/ # Next.js frontend
└── api/ # Fastify backend
```
---

## Expected valid JSON input
```bash
{
    "partyId":"enter_id",
    "payload": {
    "amount": 100, 
    "currency": "AED" }
}

```

## API Endpoints
- **POST** `/tx/encrypt`  
  Encrypts the payload and returns the encrypted result.

- **GET** `/tx/:id`  
  Returns the stored encrypted record for the given record ID.

- **POST** `/tx/:id/decrypt`  
  Decrypts and returns the original payload for the given record ID.

---

## Local Development
### 1. Clone the repository

```bash
git clone https://github.com/ashhar-sartaj/secure-transactions-service
cd secure-transactions-service
```

### 2. Clone the repository
```bash
pnpm install
```

### 3. Create your master key
inside:
```bash
apps/api/
```
Create a .env file:
MASTER_KEY=create_your_master_key
Configure and use this key inside routes.ts

### 4. Run the project
From the root of the project:
```bash
pnpm dev
```
### 5. Running URLs
- Frontend: http://localhost:3000
- Backend: http://localhost:4000