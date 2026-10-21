# Bulk evidence review — 2026-10-21

This batch reviewed public product evidence gathered by the local bulk tools. Of 169 candidate product groups, seven new products were added to the curated catalog in four functional groups. The 669 discovery pairs are leads, not reviewed replacement relationships.

| Group | Existing project | Added product | Pricing decision |
| --- | --- | --- | --- |
| Automation | Activepieces Community | [Workato](https://www.workato.com/) | Verified sales inquiry; ambiguous numeric observations withheld |
| Automation | Activepieces Community | [IFTTT](https://ifttt.com/) | Paid-plan amounts withheld pending currency confirmation |
| Forms and surveys | Formbricks Core | [Jotform](https://www.jotform.com/) | Verified sales inquiry; ambiguous numeric observations withheld |
| Customer support | Chatwoot Community | [Crisp](https://crisp.chat/) | USD 45/workspace/month (monthly); USD 95/workspace/month (monthly); USD 295/workspace/month (monthly) |
| Customer support | Chatwoot Community | [Freshdesk](https://www.freshworks.com/freshdesk/) | USD 19/agent/month (annual); USD 55/agent/month (annual); USD 89/agent/month (annual) |
| Customer support | Chatwoot Community | [Help Scout](https://www.helpscout.com/) | Verified usage model; base billing cycle withheld |
| Internal applications | Appsmith Community | [Superblocks](https://www.superblocks.com/) | Verified sales inquiry; ambiguous numeric observations withheld |

All seven relationships are independent functional-overlap reviews supported by both products’ official pages. They are not represented as claims by the open-source authors. Existing records retain their original review dates. Crisp pricing HTML includes USD AggregateOffer entries for 45, 95 and 295; the visible page identifies monthly workspace billing. Freshdesk’s official hosted-helpdesk comparison independently confirms USD for 19, 55 and 89 with annual billing. Additional seats, usage, optional features and taxes are not complete product totals.

Help Scout currency is confirmed by its official payment guide, but the pricing toggle state is unresolved. IFTTT paid-plan currency remains pending: a USD offer for the free plan is insufficient proof for paid offers. Superblocks’ generic site currency setting is insufficient plan evidence; its Teams amount remains pending. Jotform self-service prices were not reliably extracted. Contact-sales records do not assert a price.

Official evidence for each row is retained in [the catalog](../pilot.json), including the [Crisp terms](https://crisp.chat/en/terms/), [Freshworks terms](https://www.freshworks.com/terms/), [Workato terms](https://www.workato.com/legal/terms-of-service), [IFTTT terms](https://ifttt.com/terms), [Jotform terms](https://www.jotform.com/terms/), [Help Scout terms](https://www.helpscout.com/company/legal/terms-of-service/) and [Superblocks master agreement](https://www.superblocks.com/legal/master-services-agreement).

## Discovery corrections

A mention in `lissy93/portainer-templates` discusses OpnForm and Jotform; it does not make Portainer templates a Jotform replacement. Workato was discovered beside n8n, and Superblocks beside Windmill; those pairs were not silently transferred to Activepieces or Appsmith. This batch instead reviews new functional overlaps using primary sources. Third-party leads remain in the local queue.

Privacy pages, legal-department landing pages and glossary entries were found among automatic terms hints. The extractor now excludes these patterns and prefers direct agreements. Site terms for Jotform and Superblocks restrict automated collection; fresh collector requests are deferred for manual review or explicit permission. No raw vendor pages are committed or uploaded.

## Grouped review queue

These groups describe workflow status, not proprietary classification. Products already in the catalog can still contain pending facts. Each of the 169 input groups appears once.

### Previously catalogued (28)

Airtable, Algolia, Asana, Auth0, ClickUp, Confluence Cloud, Datadog, Figma, Firebase, Heroku, Intercom, Jira, Linear, Microsoft Teams, Miro, Netlify, New Relic, Notion, Pingdom, Postman, Retool, Slack, Trello, Typeform, UptimeRobot, Vercel, Zapier, Zendesk.

### Newly reviewed (7)

Crisp, Freshdesk, Help Scout, IFTTT, Jotform, Superblocks, Workato.

### Needs an official website (43)

Adobe Acrobat Pro, Amazon S3, Atlassian Statuspage, AWS Textract, Azure AI Content Safety, Bolt.new, Braintrust, Claude Code, Clearbit (HubSpot Breeze Intelligence), Contentful, Cursor, Deepgram, Docker Desktop, DocuSign, ElevenLabs, GitHub, Gmail, Google Analytics, Google Photos, HashiCorp Vault, LangChain, LangSmith, LaunchDarkly, Locked-Down Consumer Routers, Lovable, Microsoft 365, NordVPN, OpenAI AgentKit, OpenAI API (ChatGPT), OpenAI Embeddings API, OpenAI Fine-Tuning, Otter.ai, Portkey, Proprietary Smart-Home Hubs, Red Hat OpenShift, Shopify, Snowflake, Splunk, Tableau, v0, Vanta, Vectara, Weights & Biases.

### Needs page retrieval review (11)

Cloudflare Pages, ConvertKit, Drift, Dropbox Paper, Google Docs, Google Forms, Loggly, OneLogin, OpenAI API, Papertrail, Stripe Billing.

### Pages available; evidence review pending (80)

1Password, Adobe Photoshop, Amazon SES, Amplitude, AWS Amplify, AWS S3, Backblaze B2, Better Stack, Bitbucket, Bitwarden Premium, Brevo, Calendly, Canva, Canva Pro, Chargebee, CircleCI, Clerk, Cloudflare Access, Cloudflare R2, Cloudinary, DigitalOcean App Platform, Discord, Docker Hub, Dropbox, DynamoDB, Evernote, Firebase Auth, Firebase Hosting, Fly.io, Front, FullStory, GitHub Actions, GitHub Container Registry, GitHub Enterprise, GitLab Premium, Google Analytics 360, Google Drive, Google Keep, Heap, HubSpot, HubSpot CRM, Illustrator, Imgix, LastPass, LiveChat, Logtail, Mailchimp, Mailgun, Make, Microsoft 365 email, Mixpanel, monday.com, MongoDB Atlas, Neon, Okta, OneDrive, PagerDuty, Pinecone, Pipedream, Pipedrive, PlanetScale, PostHog Cloud, Postmark, Railway, Redis, Redis Cloud, Render, Replicate, Salesforce, Salesforce Service Cloud, Segment, SendGrid, Sentry, Supabase Pro, Travis CI, Tray.io, Upstash, WorkOS, Zoho CRM, Zoom.

## Sources and reproduction

Discovery inputs: [Macrostack public data](https://www.macrostack.net/data) (Data from Macrostack — CC-BY-4.0) and [awesome-saas-alternatives](https://github.com/Emmraan/awesome-saas-alternatives) (MIT; its notice is retained with each local import). Names and leads informed research; the catalog contains original summaries checked against official sources, not copied third-party descriptions or reviews. These source licenses do not change to MIT through import.

The reproducible import/collection commands and source-preservation rules are in [bulk research](../../../docs/bulk-research.md). The local run retained 287 unique page objects. Neither retrieval nor grouping confers approval. To reproduce the review, start with these seven official pricing and agreement URLs in [pilot.json](../pilot.json), then separately assess the project scope and billing configuration.

## Release validation

The research-only seed reuses the existing 66,531-repository index and writes 24 curated project rows, 41 products and 61 relationships. A full-index local rehearsal measured 411 written rows including index maintenance; production accounting may differ. Isolated D1 tests cover base-only repositories, duplicate suppression, stale activation, idempotent reimport and pointer rollback. See [small research updates](../../../docs/deployment-cloudflare.md#small-research-updates) for deployment and recovery order.
