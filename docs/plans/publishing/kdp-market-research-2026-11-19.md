# KDP market research: children's coloring book (2026-11-19)

Time-boxed brief. Every claim not backed by a fetched source is marked **unverified**.

## 1. Market snapshot

Amazon's own Best Sellers page could not be fetched. Only third-party tracker pages (ASINsight, estimates, May/June 2026) and retailer listings were readable. Treat all of this as **indicative, not verified against live Amazon BSR**.

Sources: https://www.asinsight.com/report/US/toddler-coloring , https://www.asinsight.com/report/US/kids-coloring-book

- The top sellers in "toddler coloring" and "kids coloring book" are mostly NOT plain paperback coloring books. They are licensed characters (Bluey water-reveal, Pokemon), Crayola products, reusable water-doodle books and scratch art. (ASINsight)
- 74% of tracked kids coloring products are priced $0-$10. Top 3 products take 43.6% of click share in "toddler coloring". (ASINsight)
- Plain independent toddler coloring paperbacks seen in retailer listings:
  - "The Creative Toddler's First Coloring Book Ages 1-3": 8.5x11, 100 everyday things and animals, 103 pages, $5.99, 4.8 rating (7,474 ratings) (aggregator snippets; unverified on Amazon).
  - "My First Coloring Book. Big & Easy: 60 Cute Pages for Toddlers and Kids Ages 1-3".
  - "My First Coloring Book for Toddlers 1-3: 100 Simple Pictures ... Ages 1, 2, 3 & 4", 8.5x11.
  - "Big Toddler Coloring Book", large 8.5x11 pages, printed single side (Barnes & Noble listing).
  - Another listing: "150 Easy Things & Cute Animals", $10.90.
- Observed patterns (from titles above; sample is small, **unverified as "what sells best"**):
  - Title: "My First / Big / Jumbo / Toddler Coloring Book" + "Big & Easy / Simple".
  - Subtitle: "N Cute/Simple Pictures/Pages for Toddlers and Kids Ages 1-3 (or 2-4)". The number of designs is stated in the subtitle.
  - Trim: 8.5x11 dominates. Price: $5.99-$10.90. Page counts: 60-150.
  - Themes: animals + everyday things. Cover composition and badges: **unverified** (no cover images inspected). Typical convention (unverified): bright primary colours, 3-6 cute subjects, a "Big & Simple / Ages 2-4" badge.
- Gap: water-reveal and licensed books dominate sales; a plain paperback must win on price, page quality and the "big simple" promise. Expect modest sales, not a bestseller.

## 2. Recommendation (one theme)

**Theme: farm animals and friendly farm life.** Evergreen, no trademarks, toddler-recognisable, easy for image models (single big animal, simple setting).

- Working title: **My Big Farm Animals Coloring Book**
- Subtitle: **30 Simple, Thick-Line Pictures for Toddlers and Preschoolers Ages 2-4**
- Age: 2-4 (KDP reading age fields: min 2, max 4; see Section 3, unverified field format)
- Pages: 30 drawings, single-sided, each with a blank back = **60 PDF pages** (above 24 minimum, below 79 so no spine text)
- Trim: 8.5 x 11 in, B&W interior, white paper, glossy cover
- List price: **$9.99** (crosses into the 60% royalty tier: 0.60 x 9.99 - 2.84 = $3.15/copy). Alternative $7.99 (50% tier: 0.50 x 7.99 - 2.84 = $1.16/copy) is more price-competitive against $5.99-$8 books but earns about a third as much.
- Minimum list price (KDP formula, 60 pages): 2.84 / 0.50 = $5.68 at the 50% tier.

### 30 page subjects (main subject + simple setting)
1. Big cow standing in a grassy field
2. Pig sitting in a mud puddle
3. Hen with three chicks beside her
4. Rooster crowing on a fence post
5. Sheep with fluffy wool on a hill
6. Horse standing next to a barn door
7. Duck swimming on a small pond
8. Goat nibbling a tuft of grass
9. Donkey with long ears in a meadow
10. Farm cat curled on a hay bale
11. Farm dog sitting by a doghouse
12. Bunny eating a carrot in a garden
13. Turkey with fanned tail in a yard
14. Lamb lying down next to a flower
15. Calf drinking from a bucket
16. Red barn with an open door and a sun
17. Tractor with big wheels on a dirt road
18. Scarecrow in a field with a bird on his hat
19. Hay bale stack with a pitchfork-free background (bales only)
20. Big sunflower with a smiling bee
21. Wheelbarrow filled with pumpkins
22. Basket of eggs on a small table
23. Watering can next to two flowers
24. Windmill with a few clouds
25. Apple tree with three apples and a ladder
26. Milk bottle and a cow-spotted mug on a table
27. Pony wearing a flower crown in a paddock
28. Goose waddling along a path
29. Snail on a big leaf in the garden
30. Smiling sun over a row of vegetables (carrot, cabbage, tomato)

Prompt guidance (our pipeline): one centred subject filling ~70% of page, bold uniform outline, no shading or grey fill, no tiny detail, plain white background, no text.

## 3. KDP facts

| Fact | Value | Source |
|---|---|---|
| Minimum page count | 24 (paperback, black ink on white/cream paper) | https://kdp.amazon.com/en_US/help/topic/G201834180 |
| Spine text minimum | at least 79 pages (Cover Creator/Studio: 80). 60 pages = no spine text | https://kdp.amazon.com/en_US/help/topic/G201953020 |
| Interior bleed | Optional. No bleed: PDF = trim size (8.5 x 11 in). With bleed: 8.625 x 11.25 in (add 0.125 in width, 0.25 in height). If any page needs bleed, whole file uses bleed. Our line art stays inside margins, so use no bleed | https://kdp.amazon.com/en_US/help/topic/GVBQ3CMEQW3W2VL6 |
| Interior margins (24-150 pages) | Inside/gutter 0.375 in; outside, top, bottom at least 0.25 in without bleed (0.375 in with bleed) | same as above |
| Cover size formula | Width = bleed + back + spine + front + bleed; height = bleed + trim height + bleed; bleed 0.125 in | https://kdp.amazon.com/en_US/help/topic/G201953020 |
| Spine width, white paper | pages x 0.002252 in (60 pages = 0.135 in) | same |
| Cover for 8.5x11, 60 pages, white (computed, not quoted) | 17.25 + 0.135 = **17.385 in wide x 11.25 in high** | derived from formula above |
| Cover text safe zone | at least 0.125 in inside trim | same |
| Max keywords | 7 keyword boxes: **unverified** on KDP help pages (fetched help page gives no number; widely cited by third-party guides). KDP recommends 2-3 word phrases | https://kdp.amazon.com/en_US/help/topic/G201953870 |
| Categories | up to 3 (per KDP help; third-party guides disagree, dashboard is authoritative) | https://kdp.amazon.com/en_US/help/topic/G201953870 |
| Title/subtitle | Title field = title exactly as on cover; subtitle optional, same rules; title + subtitle under 200 characters; no repeated generic keywords, no "bestselling"/"free", no trademarks, no HTML; cover must match metadata | same |
| Low-content box | Coloring books are listed under "Not Generally Low-Content". Do NOT tick it. Low-content would block Expanded Distribution and the free KDP ISBN | https://kdp.amazon.com/en_US/help/topic/GGE5T76TWKA85DJM |
| AI disclosure | Must disclose AI-generated text, images (cover, interior, artwork), translations when publishing/republishing. AI-assisted (you made it, AI only edited/brainstormed) need not be disclosed. Our pipeline images are AI-generated: disclose **images = yes**. Exact form fields/dropdown options are not described on the help page: **unverified** (third-party guides report yes/no plus separate text/images/translations dropdowns) | https://kdp.amazon.com/en_US/help/topic/G200672390 |
| Children's age range | Reading age optional but without it the book may not qualify for children's categories or age searches. Exact min/max field format: **unverified** | https://kdp.amazon.com/en_US/help/topic/G201953870 |
| KDP Select | eBook-only program; does not apply to paperbacks (the page only lists it for Kindle). Paperback options: Amazon distribution + optional Expanded Distribution | https://kdp.amazon.com/en_US/help/topic/G200735480 |
| Expanded Distribution royalty | 40% of list price minus printing cost | https://kdp.amazon.com/en_US/help/topic/G201834330 |
| Printing cost (amazon.com, black ink) | 24-110 pages: fixed $2.30 (regular trim) or $2.84 (large trim: over 6.12 in wide or over 9 in high, so 8.5x11 is large). 110-828 pages: $1.00 + $0.012/page (regular) or $0.017/page (large) | https://kdp.amazon.com/en_US/help/topic/G201834340 |
| Printing cost, our book (60 pages, 8.5x11) | **$2.84** | derived |
| Royalty | 60% at list price $9.99 or more; 50% at $9.98 or less (amazon.com). Royalty = rate x list - printing cost | https://kdp.amazon.com/en_US/help/topic/G201834330 |
| Min list price | printing cost / royalty rate = 2.84 / 0.5 = $5.68 (KDP computes it itself) | https://kdp.amazon.com/en_US/help/topic/G201834340 |

Note: the printing-cost page lists "110" in both the 24-110 and 110-828 ranges; irrelevant at 60 pages.

## 4. Listing guidance

### 7 backend keyword phrases (all **unverified** for search volume; keep to 2-3 word phrases, do not repeat title words)
1. farm animals coloring pages
2. toddler coloring book ages 2-4
3. big simple pictures for kids
4. preschool coloring activity book
5. first coloring book for toddlers
6. barnyard animals drawing book
7. gift for 3 year old

### Categories (up to 3; exact browse-path names **unverified**, confirm in the KDP picker)
1. Books > Children's Books > Activities, Crafts & Games > Coloring Books
2. Books > Children's Books > Animals > Farm Animals
3. Books > Children's Books > Early Learning (or Activities, Crafts & Games > Activity Books)

### Description (~150 words)
Allowed HTML: `<br>`, `<p>`, `<b>`, `<em>`, `<i>`, `<u>`, `<h4>`-`<h6>`, `<ol>`/`<ul>` with `<li>`. `<h1>`-`<h3>` are not supported. Limit 4,000 characters including tags. No URLs, reviews, pricing or contact details. Source: https://kdp.amazon.com/en_US/help/topic/G201189630

Structure (hook, benefits bullets, what's inside, gift/call to action; the structure is the common convention, **unverified** as top-seller pattern):

```html
<p><b>Little hands, big pictures, zero frustration!</b> Meet the cow, the pig, the hen and 27 more farm friends.</p>
<h4>Why toddlers and parents love it</h4>
<ul>
<li>30 big, simple pictures with thick outlines that are easy to color inside</li>
<li>Single-sided pages: one picture per page, nothing bleeds through</li>
<li>Large 8.5 x 11 inch pages, perfect for crayons, chunky pencils and washable markers</li>
<li>Familiar animals and farm things that help build first words</li>
</ul>
<h4>What's inside</h4>
<p>Animals, a red barn, a tractor, sunflowers, pumpkins and more. Every page has one clear subject and plenty of space for creativity.</p>
<p>Great for ages 2-4, quiet time, car trips, birthdays and preschool. <b>Grab a copy and let the coloring begin!</b></p>
```

## 5. Open risks
- Sales volume of plain paperback toddler coloring books in the data seen is low relative to water-reveal and licensed products.
- KDP content review may flag low-quality AI interiors; check every page (no stray text, anatomy errors, grey fill).
- All "unverified" rows above need a check in the live KDP dashboard before publishing.
