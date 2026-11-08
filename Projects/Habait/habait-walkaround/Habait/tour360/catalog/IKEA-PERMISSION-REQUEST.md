# Permission request to IKEA Israel — DRAFT v2 for Slava to send (D-CAT-21; v2 after the warden's read T15a, finding F9, 2026-10-07 night)

**Status: DRAFT, not sent.** The sender's details, the recipient's address, the date and the three bracketed facts (the price-refresh
owner and cadence, the hosting region) are yours to fill; the letter goes from your own mailbox, nothing here is automated. Until
IKEA Israel answers in writing, the catalog page runs on the laptop only (D-T360-27, D-CAT-21): no deploy of a `--catalog` build, no
frame with a product photo outside the private repo, no outside demo or screen share of the catalog page (OQ-C19). A Hebrew version can
be drafted on your word. **The rights chain is yours and the lawyer's (OQ-C18):** whether IKEA Israel's marketing team can grant the
photo, trademark and product-design rights, or whether the request must go to the brand owner, is not something this draft can settle.

What changed from v1 (the warden's gaps): the vendors and the data flow are named, with a commitment on their retention and training
terms; the AI-generated depiction itself is asked for, not only the photos, names and prices; the two disclosure lines are described
exactly as the page shows them; the trademarks are asked for and the attribution is stated as it is; the takedown and the price refresh
have an owner and a cadence to fill; territory, duration, hosting and the use to date are stated; the rights-chain question is asked.

---

**To:** IKEA Israel — the marketing / brand team (or whoever at IKEA Israel handles third-party use of product imagery and trademarks)
**Subject:** Permission to show IKEA products, as photos and as AI renderings, inside an apartment-tour demo

Dear IKEA Israel team,

I am [name], [role] at Habait (habait.ai), an Israeli real-estate platform that helps buyers understand new-build apartments before
they are built.

We are building a 360° apartment tour in which a visitor can tap a piece of furniture in a rendered room and see how an IKEA product
would look in its place. We would like your written permission for the following, for five products to begin with:

1. **Your product photos, names and prices.** The product's official photo from ikea.com/il is shown as a small thumbnail on an item
   card beside the product's name, its price on your site with the date it was read, and a link to the product page.
2. **An AI-generated depiction of the product in the room.** An image model draws the product into the rendered room, using your
   product photo as its visual reference. That depiction is shown to the visitor inside the tour. Two notices accompany it: every
   rendered room in the tour carries a permanent notice that the imagery is a concept rendering made with AI, and the item card
   carries the line «An AI likeness of the product. The real product may look different» (in Hebrew, English and French).
3. **The IKEA name and the product names,** used to identify the products: on the card, in the link text («View on IKEA») and in
   the hint that names the product being placed. We make no claim of affiliation, sponsorship or endorsement, and will add a
   non-affiliation line if you want one.
4. **The data flow behind the rendering.** To draw the product we send your product photo, together with the room image, to the image
   model's vendor (fal.ai, model «nano-banana-2») and, to check the result, to a vision model through OpenRouter. We will confirm
   both vendors' data-retention and model-training terms to you in writing before any public use, and we will stop using any vendor
   you object to.
5. **Further products later,** under the same conditions, if you agree.

Where and how long: the tour is for the Israeli market, in Hebrew, English and French, hosted on [hosting provider and region]; we ask
for the permission for the duration of the demo and, should the feature ship, for the product, with the right for you to withdraw it
in writing at any time.

What we commit to:

- **Attribution** on every card as described above, and no use of your photos or names anywhere else.
- **Prices** read from your site by hand, shown with their reading date, and refreshed by [owner] at least every [cadence].
- **Removal** of any product, or of the whole catalog feature, within one business day of your written request.
- **No alteration** of your product photos; the AI depiction is labelled as such wherever it appears.

Use to date: we have tested the feature on a private laptop with five product photos read from ikea.com/il; nothing has been
published and no third party has seen it.

The five products (read on 2026-10-07): KIVIK 3-seat sofa · STRANDMON wing chair · KRAGSTA coffee table · SKANSNÄS extendable table ·
ODGER chair (the product pages are listed below).

If some of these rights are held by another IKEA entity, we would be grateful if you could route this request or tell us whom to
ask. If a licence, a partnership or a different arrangement suits you better, we would be glad to discuss it.

Thank you for considering this.

[name]
[role], Habait · habait.ai
[phone] · [email]

Product pages (read on 2026-10-07):
- KIVIK 3-seat sofa — https://www.ikea.com/il/he/p/kivik-3-seat-sofa-tibbleby-beige-grey-s49440597/
- STRANDMON wing chair — https://www.ikea.com/il/he/p/strandmon-wing-chair-grann-bomstad-dark-brown-00494638/
- KRAGSTA coffee table — https://www.ikea.com/il/he/p/kragsta-coffee-table-white-20286638/
- SKANSNÄS extendable table — https://www.ikea.com/il/he/p/skansnaes-extendable-table-brown-beech-veneer-00565758/
- ODGER chair — https://www.ikea.com/il/he/p/odger-chair-anthracite-50457313/

---

**When an answer comes:** a written yes lifts D-CAT-21 for the items and the uses it names (record it in `CATALOG-PLAN.md` §3 and PLAN
OQ-14; then T15b on your deploy go, T15c); a partial yes (photos but not the AI depiction, or no vendor transmission) changes the
feature, not the posture; a no, or silence, keeps the laptop posture and opens OQ-C2's other sources (our own photographs, a licensed
feed). The frames in `qa-evidence/tour360/T14/laptop/` and `T16/**` show the page's own thumbnails of the photos; a refusal makes their
removal a warden-gated clean-up (OQ-C19).
