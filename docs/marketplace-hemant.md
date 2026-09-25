# Marketplace submission preparation — draft

This is not a submitted or certified listing. The working title is **Pi for Excel - Hemant**. Confirm the final name, branding, publisher identity and support contact before submission. Preserve the upstream MIT license and copyright notices; a fork is not an official upstream release.

## Draft listing text

An open-source AI assistant sidebar for Excel. Connect a supported AI provider to read spreadsheet ranges, write values and formulas, and apply formatting through chat. Review changes using the project's recovery features. An API key or a supported provider login is required; provider charges and restrictions may apply. Some optional integrations require additional services or local software.

## Required owner/account work

- Complete Partner Center enrollment and business verification using accurate legal information. Microsoft currently documents a company account and authority to accept its agreements. Do not register on behalf of your employer without that authority.
- Supply a real support contact and final publisher name; the GitHub handle in the generated manifest is a working default, not proof of verified publisher identity.
- Publish and review an accurate privacy policy and terms for this deployment. No final legal policy is fabricated in this PR.
- Supply actual Excel screenshots, required listing artwork, final descriptions, platform support and reviewer testing instructions.
- Provide an authorized reviewer/demo setup if the chosen provider requires login. Never commit API keys or test credentials to GitHub.

## Privacy facts to verify before drafting the policy

The README describes automatic workbook context, user prompts and tool results being sent to the selected AI provider, and local browser storage for sessions/settings. The Pages relay forwards Mercury chat requests and the user's API key to Inception Labs without storing them in application code. Audit the current implementation, enabled integrations, hosting logs, retention, deletion, credential storage and optional gateways before making privacy promises. Do not claim workbook data never leaves the device. Do not put confidential company workbooks into public screenshots or reviewer samples.

## Release gates

1. Successful production build and manifest validation.
2. Public stable HTTPS taskpane/icon URLs, correct production manifest identity and support links.
3. Successful Excel tests on every advertised supported platform, including provider connection and actual read/write operations.
4. Review of extension execution, AI-generated code and optional bridge features against current Marketplace certification rules. Approval is not guaranteed.
5. Owner completes listing/account requirements, submits the generated manifest, and addresses Microsoft's review feedback.

Source: https://learn.microsoft.com/en-us/partner-center/marketplace-offers/submit-to-appsource-via-partner-center

Account requirements: https://learn.microsoft.com/en-us/partner-center/marketplace-offers/open-a-developer-account
