# Project TODO List (User Requirements Only)

## Core SaaS Features
- [ ] Multi-tenant support: Each business/client has isolated data and channels
- [ ] Business owner dashboard: Owners can see all AI/customer conversations in real time
- [ ] Human handover: Business owner can take over conversation from AI at any time
- [ ] Channel support: WhatsApp, Messenger, etc. (via chosen platform)

## Advanced AI/Retrieval Features
- [ ] Pluggable chunking methods: Fixed-size, recursive, semantic, etc.
- [ ] Pluggable re-ranking: Add re-ranking and allow user to choose method
- [ ] Advanced memory: Customizable memory for conversations
- [ ] Query optimization: Efficient retrieval and response

## Security & Privacy
- [ ] Row-level security (RLS) for all sensitive tables (e.g., profiles)
- [ ] Ensure disk-level encryption is enabled (Supabase Cloud: already enabled)
- [ ] (If needed) Application-level encryption for highly sensitive fields

## Infrastructure
- [ ] Use Inbox ID (or equivalent) for project/channel mapping
- [ ] Deploy on cost-effective VPS (e.g., Hetzner, 2 vCPU, 4–8GB RAM)
- [ ] Use company email for hosting/service signups

---

**This list only includes features and requirements explicitly mentioned by the user.** 