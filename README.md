# Sim Template

Example code for creating high-fidelity Solana simulations to optimize protocol parameters, check pre-deploy regressions, validate oracle update etc.

## Setup

1. Install dependencies
```bash
npm install
```


2. Configure environment variables in `.env.local`

3. Start running
```bash
npm run build
```

```bash
npm start
```

## Notes

- This framework is intentionally minimal, so add additional logic as needed
- Account notifications are automatically cached for efficient access
- Transactions can be submitted during slot progression via `sendUpdates()`
