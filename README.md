# Cloud Pulse Dashboard

Build a dark-themed cloud monitoring dashboard web app called "CloudPulse". No auth, no backend, frontend only.

Layout: Fixed left sidebar (240px wide) with the logo/name "CloudPulse" at top, then nav items with lucide-react icons: Overview, Infrastructure, Alerts, Settings (only Overview needs real content; others can be simple placeholder pages). Top bar with the current page title on the left and a time-range selector dropdown on the right with options: Last 1 hour, Last 6 hours, Last 24 hours, Last 7 days (default: Last 6 hours).

Overview page: A responsive grid of panels (2 columns on desktop, 1 on mobile). Each panel is a card with a header showing its title, and a body containing an iframe filling the card (height ~340px). While an iframe loads, show an animated shimmer skeleton over it.

Panel config: Define all panels in ONE config file, an array where each entry has { title, baseUrl }. Include 4 placeholder entries: "CPU Utilization", "Network In/Out", "Memory Usage", "Request Count", each with baseUrl "http://localhost:3000/d-solo/REPLACE_ME?orgId=1&panelId=1". Build each iframe src by taking baseUrl and appending time-range params.

Time-range wiring: Keep the selected range in state. Map it to Grafana URL params: 1h → &from=now-1h&to=now, 6h → &from=now-6h&to=now, 24h → &from=now-24h&to=now, 7d → &from=now-7d&to=now. Every iframe src = baseUrl + range params + "&theme=dark&kiosk&refresh=60s". When the dropdown changes, all iframes update.

Style: Page background #181b1f, card background #22252b, borders #2c3235, text #e0e2e7, muted text #8e939c, one accent color #4f8ff7 used sparingly (active nav item, dropdown highlight). Inter font. Minimal, modern, premium feel like Linear or Vercel — subtle 1px borders, 8px card radius, generous spacing, no gradients, no clutter.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/efead255-0c71-41c0-b1dd-44ea2932b2a2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
