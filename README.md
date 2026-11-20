# NAGASARIBU AI WORKFORCE

Cloud-first foundation for the NAGASARIBU AI Workforce.

## Phase 1
- Cloudflare Worker API foundation
- Health endpoint
- Safe-by-default architecture
- Future integrations: Supabase, Telegram, and DeepSeek (optional)

## Initial modules
- SARA — orchestration and operations
- QS AI — quantity surveying and construction
- Marketing AI — campaigns and lead generation
- Finance AI — budgeting and financial analysis
- Technical AI — engineering and system support
- Creative Studio — image, poster, and video workflows

## Development principles
- Keep BINARUMAH, BARANGVIRAL, and JUTAONE deployments isolated.
- Never change existing DNS, Pages projects, or production databases as part of this Worker setup.
- Store API keys as Cloudflare secrets; never commit secrets.
- Require explicit approval for payments, publishing, account changes, destructive actions, and external commitments.
- RM0-first means using free tiers where available; it does not mean unlimited free model or video generation.

## Local development
```bash
npm install
npm run dev
```

## Deploy
```bash
npm run deploy
```

Test `/health` after deployment.
