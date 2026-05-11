# Roadmap

This file provides an overview of the direction this project is heading. The roadmap is organized in steps that focus on a specific theme, for instance, UX.

## [M1 — Storefront Experience](https://github.com/openumkm/openumkm/milestone/1)

In this phase the focus is on redesigning the customer-facing pages for a more professional look and giving store owners control over their brand colors. The expected features are:

- **Theme color customization** — A new "Appearance" tab in `/admin/settings` where the seller can pick primary, secondary, and accent colors. Values are stored as settings and injected as CSS custom properties so the entire storefront reflects the chosen palette without a rebuild.
- **Revamped home page** — Cleaner hero section, improved product grid with better image aspect ratios, dedicated category browsing section.
- **Revamped product detail page** — Image gallery with thumbnails, better variant selector, structured description layout.
- **Revamped cart page** — Modern item list with quantity stepper, clear subtotal summary, prominent checkout button.
- **Revamped checkout page** — Streamlined address form, clearer payment method selection, polished order summary sidebar.
- **Revamped customer dashboard** — Improved order history table, address book card layout, consistent sidebar navigation.
- **Mobile-first responsive** — All storefront pages adapt gracefully to mobile screens with proper touch targets, stacked layouts, and off-canvas navigation.
- **Design system** — Unified typography scale, spacing tokens, and component patterns across all storefront pages. Avoids the current "generated" visual style (gradient orbs, excessive badge animations).

## [M2 — Admin & Onboarding](https://github.com/openumkm/openumkm/milestone/2)

In this phase the focus is on making the admin panel more approachable — helping new sellers configure external services, managing their customers, and getting their store off the ground with sample data. The expected features are:

- **Xendit setup guide** — A step-by-step walkthrough under the Xendit fields explaining how to create a Xendit account, grab the secret key from the dashboard, and configure the webhook endpoint with a verification token.
- **RajaOngkir setup guide** — A step-by-step walkthrough under the RajaOngkir fields explaining how to register at Komerce/RajaOngkir, choose a plan, get the API key, and find the correct origin city ID.
- **SMTP setup guide** — A step-by-step walkthrough under the SMTP fields explaining how to create an app password for Gmail, Brevo, or Mailgun (users often confuse email password with app password).
- **Expandable help panels** — Each guide is displayed as a collapsible accordion directly below the relevant input field rather than linking to a separate documentation page. Guides are plain text (5–8 steps) with links to official docs where appropriate.
- **Demo data on onboarding** — During the first-run setup wizard, offer an option to populate the store with sample products, categories, and a completed store configuration. This gives new sellers an immediate preview of how their storefront will look without manually creating content first.
- **Customer management page** — A new page at `/admin/customers` listing all registered customers with name, email, order count, and join date. Includes search and the ability to view a customer's order history and saved addresses.
