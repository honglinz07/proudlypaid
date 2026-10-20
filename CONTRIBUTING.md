# Contributing

Thanks for helping make software less affordable. Your contribution, unfortunately, remains free.

## Development

1. Use Node.js 24+ and npm 11+.
2. Install the locked dependencies with `npm ci`.
3. Initialize local data with `npm run db:local -- --curated-only`, then run `npm run dev` and make a focused change.
4. Run `npm run check` before opening a pull request.
5. For interface changes, check a desktop and a narrow mobile viewport, keyboard use, and both languages.

## Catalog suggestions and corrections

Use the website's **Contribute** page or the **Catalog suggestion or correction** issue template. A project request is useful even when the commercial alternative is unknown. Include the open-source repository and relevant edition, the product's official URL, overlapping features and limitations. For a price correction, include the plan, region, currency, unit, payment cycle, configuration and review date.

The website prepares a Markdown draft locally; it does not submit it. Copy the draft into the GitHub template and review it before posting. Use public evidence and avoid copying entire third-party descriptions, README files, logos or private information. Paid is not proof of proprietary licensing. Leads remain unverified until reviewed and are not added to search automatically.

## Project principles

- Keep frontend and API independently buildable and deployable.
- Keep the search box central and the tone straight-faced. The interface must remain usable.
- Keep historical fictional fixtures out of live routes. Real product names, features, prices, and licenses require a cited source and a verification date before entering the catalog. Pending product classifications and unverified amounts must not be published.
- Use a comparable price basis. Never invent prices for enterprise quotes.
- Keep search inside the versioned API contract. Do not add tracking, accounts, remote deployments or external services as incidental work.
- Never commit credentials, local environment files, dependency folders, or build output.
- Contribute only code and assets you can license under MIT. Preserve third-party license notices.

Please describe what changed and how you checked it. Include screenshots for visual changes when practical. Contributions are provided under the repository’s MIT license.
