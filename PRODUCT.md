# Product

## Register

product

## Users

Two distinct groups, both matter:

**dApp developers** (primary integrator) — they install the kit, configure the modal's theme, layout, and adapters, then ship it to their users. They judge the modal by: does it look good in my app, does it work on mobile, can I match my brand, will it embarrass me? They see the configuration API and the rendered output in their own product.

**dApp end users** (primary interaction) — regular people connecting a wallet to use an XRPL application. They may be unfamiliar with wallet concepts. They see the modal for 5–30 seconds per session, under pressure to connect quickly and get back to the task they came for. They are on phones as often as desktops. A confusing modal means they abandon the dApp.

## Product Purpose

The wallet connect modal is a trust moment. The user is about to grant a dApp access to their XRPL account — they need to feel safe, oriented, and in control. The modal must make every wallet option immediately scannable, guide the user through QR scanning or extension approval without friction, and get out of the way once the job is done.

Success: a first-time XRPL user connects their wallet in under 15 seconds and doesn't feel like they made a mistake.

## Brand Personality

Calm. Clear. Trustworthy.

Not exciting — the moment of connecting a wallet is not the moment to impress with design flourishes. The modal should feel like a well-made browser dialog: obvious, fast, and forgettable in the best way. Any dApp that uses it should feel like the modal belongs there, not like a third-party widget was pasted in.

References: MetaMask's new connect flow, Stripe's payment modal, Linear's command palette — precise, purposeful, zero decoration.

## Anti-references

- **Crypto-hype aesthetic** — neon gradients, glow effects, animated backgrounds. The user is about to sign something; this is not the moment for fireworks.
- **Web3 dark mode as default** — full dark with colored glow reads as "NFT project from 2021." The modal must work equally well on light and dark host apps.
- **Overloaded information** — showing too much wallet metadata, promotional banners, or secondary CTAs during the connect flow. Every extra element increases abandonment.
- **Heavy and slow** — the modal must open in under 100ms and feel instant. No janky entrance animation, no layout shift.

## Design Principles

1. **Invisible infrastructure.** The modal should feel native to the host dApp, not like an imported widget. Theming must be deep enough that a developer can make it match their app in under 10 minutes.
2. **Scannable in one pass.** A user should identify their wallet and tap it within 3 seconds of the modal opening. Layout, icon size, and label hierarchy must support that.
3. **Guide, don't gate.** QR screens, connection states, and error states must always tell the user what to do next. No dead ends. Every error has a retry path.
4. **Mobile is equal, not afterthought.** Bottom sheet on mobile is the default. Touch targets minimum 44×44px. QR code must be large enough to scan without zooming.
5. **Theme by default, own nothing.** The modal ships with a sensible default theme, but every color token is overridable. The default must not impose a brand that clashes with common host app palettes.

## Accessibility & Inclusion

WCAG 2.1 AA. Focus trap within modal while open. `aria-modal`, `aria-live` for status updates, `role="dialog"`. Keyboard: Tab cycles focusable elements, Escape closes. `prefers-reduced-motion` respected — entrance animation becomes an instant opacity crossfade. Touch targets 44×44px minimum on all interactive elements. QR code has screen-reader description.
