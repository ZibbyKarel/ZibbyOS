# MakerWorld 3D models and other digital-product channels: research (2026-11-19)

Scope: vetted agent skill for code-CAD 3D models, macOS toolchain, MakerWorld publishing and AI policy, model ideas, other marketplaces.
Method: web search plus `gh api` for repo stats (queried 2026-11-19), vendor wiki pages fetched directly where possible.
Conventions: **[V]** = verified on a primary source I opened, **[S]** = only from a search-result summary or third-party blog, **[U]** = unverified / from general knowledge. Nothing here is TLP-marked.

---

## TL;DR

- **Recommended skill: `earthtojake/text-to-cad`** (build123d, MIT, 26.9k stars, pushed today). Runner-up for a lighter, permissive option: **`mitsuhiko/agent-stuff` openscad skill** (Apache-2.0). The technically nicest printability loop is `flowful-ai/cad-skill` (CadQuery), but its licence is **PolyForm Noncommercial**, which is a likely blocker for a monetised pipeline.
- **MakerWorld is the hardest-to-automate and most AI-hostile channel in this list.** No official upload API (web UI only, Cloudflare-protected). AI models are allowed but must be labelled "AIGC" **[S]**, real photos of a printed object are required for print profiles **[V]** and (since 2026-02-05) for the model itself **[S]**, AI content and flat/simple models (keychains, coasters, clips...) are excluded from the Exclusive (cash) programme **[V]**. Realistic outcome: free-tier reach and points, not the cash programme, and a human has to print and photograph every model.
- **Top picks for a one-person automated pipeline** (section 5): 1) Etsy digital downloads (has an API), 2) Gumroad/Payhip-style own storefront for the same files, 3) KDP puzzle/low-content (already built), 4) Adobe Stock (AI accepted if labelled), 5) Printables/Thingiverse/Cults3D cross-listing of the same STL/3MF.

---

## 1. Agent skills / MCP servers for code-CAD

Stats from `gh api` on 2026-11-19 **[V]** unless noted.

| Candidate | Stars | Last push | Licence | Kernel | Previews | Printability validation | Install |
|---|---|---|---|---|---|---|---|
| [earthtojake/text-to-cad](https://github.com/earthtojake/text-to-cad) | 26,889 | 2026-11-19 | MIT | build123d / OCCT | `cad model snapshot id out.png` (multi-camera, hidden-line, `--preview` lit) | Yes: "Can it be made?" DFM check for 3D printing, interference check, check scripts, mass/clearance **[V that it exists, S on exact print rules; I did not read the printing reference]** | `curl -fsSL https://texttocad.dev/install.sh \| sh` or manual: `uv tool install cad` + plugin ([install doc](https://github.com/earthtojake/text-to-cad/blob/main/docs/install.md)) |
| [flowful-ai/cad-skill](https://github.com/flowful-ai/cad-skill) | 732 | 2026-11-09 | **PolyForm Noncommercial 1.0.0** (GitHub shows NOASSERTION; LICENSE file read) | CadQuery | headless pyrender multi-view PNG | Yes: `run_cadquery_model.py --preview --strict` fails on non-watertight (trimesh), `--bed a1/p1s/x1c/...` fails if it exceeds the bed, `mating.py` collision/clearance check, `design-review.md` checklist, `stl_to_3mf.py` | `git clone https://github.com/flowful-ai/cad-skill ~/.claude/skills/parametric-3d-printing`, then `uv pip install -r requirements.txt` (Python 3.10-3.12 only) |
| [mitsuhiko/agent-stuff](https://github.com/mitsuhiko/agent-stuff) (`skills/openscad`) | 3,221 (whole repo) | 2026-09-27 | Apache-2.0 | OpenSCAD | `preview.sh`, `multi-preview.sh` (front/back/left/right/top/iso) | Syntax validate + "visual validation required"; no manifold/mesh check **[V from SKILL.md head]** | copy `skills/openscad` into `~/.claude/skills/`, `brew install --cask openscad` (or `npx skills add`, listed in a marketplace page **[S]**) |
| [rawwerks/VibeCAD](https://github.com/rawwerks/VibeCAD) (build123d skill) | 128 | 2026-01-05 | MIT | build123d | not checked | not checked | not checked |
| [andreahaku/openscad_claude_skill](https://github.com/andreahaku/openscad_claude_skill) | 31 | 2026-10-17 | none stated | OpenSCAD | claims preview/iterate/STL reconstruct **[S]** | not checked | clone into skills dir |
| [JonFermin/cadsmith](https://github.com/JonFermin/cadsmith) | 13 | 2026-10-03 | MIT | CadQuery(?) | not checked | not checked | - |
| [mfranzon/render](https://github.com/mfranzon/render) | 182 | 2026-08-04 | none stated | n/a | "beautiful 3D models" renders, likely not print-oriented **[S]** | - | - |
| OpenSCAD MCP servers: [quellant/openscad-mcp](https://github.com/quellant/openscad-mcp) (174 stars, MIT, 2026-09), [jkoets/OpenSCAD-MCP](https://github.com/jkoets/OpenSCAD-MCP) (1, MIT, 2025-12), [petrijr/openscad-mcp](https://github.com/petrijr/openscad-mcp) (4, MIT, 2026-01), karolkaczmarek1 (4, no licence) | 1-174 | 2025-12 to 2026-10 | MIT mostly | OpenSCAD | PNG preview / multi-angle returned to the LLM **[S]** | none that I saw | per README |
| [anthropics/skills](https://github.com/anthropics/skills) | 197,656 | 2026-11-16 | n/a | - | - | I did not find a CAD/3D-printing skill in the official repo (listing not exhaustively checked **[U]**) | - |

Notes
- OpenSCAD MCP servers are small, low-star, mostly single-maintainer. A plain skill plus the CLI gives the same loop with less moving parts. Not recommended.
- text-to-cad evidence of maturity: PyPI package `cad` (version 0.11.13 referenced in its skills), CI badge, Discord, migration guides, 20+ agent apps supported, also has `print3d` skill (OrcaSlicer headless slicing, Bambu Connect hand-off, "never starts a print") **[V]**.
- text-to-cad caveats **[V]**: telemetry (usage stats and crash reports with random ID) is **on by default**, installer is `curl | sh` and enables auto-updates. For an unattended pipeline prefer the manual install, pin the `cad` version, and disable telemetry (see its [privacy policy](https://www.texttocad.dev/privacy-policy) for the switch; I did not confirm the exact flag). Also it is a large surface (PCB, FEA, drawings...) when we need only parts and STL/3MF.
- flowful-ai caveat **[V]**: PolyForm Noncommercial forbids commercial use. Whether publishing free models on MakerWorld for points counts as commercial is a legal grey zone; selling anything built with it is not allowed. Ask the author for a commercial licence before depending on it. The repo's examples were published on MakerWorld by the author (README).

### Recommendation

1. **Primary: earthtojake/text-to-cad.** Best-maintained, MIT, build123d gives exact B-rep so STL/3MF exports are manifold by construction, built-in manufacturability check and snapshot rendering the agent can look at, 3MF export, and a slicing skill (OrcaSlicer) that doubles as a printability test.
2. **Runner-up: mitsuhiko openscad skill** (Apache-2.0, trivial, deterministic, targets "MakerWorld" in its description). Add our own mesh check (trimesh/admesh, section 2) because it has none. If licence is cleared, cad-skill's `--strict --bed` loop is the best printability gate to copy as an idea.
3. Image-to-3D (briefly): MakerWorld's own MakerLab tools (Image to 3D Model, Make My Statue...) exist, but models made with them are explicitly excluded from the Exclusive programme **[V, exclusive-model-guideline]** and AI-mesh output is typically non-manifold and unreliable. Not recommended for a "no junk" goal. No specific third-party image-to-3D tool vetted here.

---

## 2. macOS toolchain for a verified pipeline

Versions per `brew info` on this machine today **[V]**:

| Tool | Package | Version | Note |
|---|---|---|---|
| OpenSCAD | `brew install --cask openscad` | 2021.01 | Old release. `openscad@snapshot` cask is 2026.10.11 and is the one with faster Manifold backend |
| OpenSCAD snapshot | `brew install --cask openscad@snapshot` | 2026.10.11 | Use for speed/robustness; flag `--backend=manifold` **[U, from memory, confirm with `openscad --help`]** |
| admesh | `brew install admesh` | 0.98.5 | STL repair/stats (non-manifold edges, flipped normals) |
| trimesh | `uv pip install trimesh numpy` (or `pip install trimesh`) | - | `is_watertight`, `is_winding_consistent`, volume, bounds |
| OrcaSlicer | `brew install --cask orcaslicer` | 2.5.1 | CLI at `/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer` |
| PrusaSlicer | `brew install --cask prusaslicer` | 2.9.7 | alternative CLI slicer |
| Bambu Studio | `brew install --cask bambu-studio` | 02.09.01.70 | needed to produce the Bambu print-profile 3MF; GUI-first |
| uv | `brew install uv` | 0.13.9 | for python tools |

Not installed on this machine right now (`which openscad trimesh` found nothing). I installed nothing.

CLI invocations
```bash
# OpenSCAD: STL + preview PNG (flags from the official man page [S]; --render forces full render before snapshot)
openscad -o model.stl model.scad
openscad -o model.png --render --imgsize=1600,1200 --camera=0,0,0,55,0,25,300 --colorscheme=Tomorrow model.scad
openscad -o model.3mf model.scad                  # 3MF export is supported by the CLI
openscad -o model.stl -D 'width=60' -D 'height=30' model.scad   # parametric override

# Mesh gate (trimesh)
python3 -c "import trimesh,sys; m=trimesh.load(sys.argv[1]); print(m.is_watertight, m.is_winding_consistent, m.volume, m.bounds)" model.stl
# Mesh gate (admesh): reports edges fixed / non-manifold counts
admesh --check model.stl            # [U] flag names; use plain `admesh model.stl` to print stats

# Printability test by slicing (OrcaSlicer headless), from text-to-cad's print3d skill [V]
/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer model.stl \
  --load-settings "presets/process.json;presets/printer.json" --load-filaments presets/filament-1.json \
  --arrange 1 --slice 0 --outputdir /abs/out --export-3mf model.gcode.3mf
```
Caveats
- OrcaSlicer 2.5+ keeps built-in presets in binary caches that text-to-cad's `cad orcaslicer` helper cannot read; headless slicing then needs a folder of complete preset JSONs **[V, print3d SKILL.md]**. Budget a one-time setup: export the A1/P1S/X1C presets from the GUI and commit them.
- Pass criteria to automate: watertight + consistent winding, volume > 0, bounds fit target bed (A1 mini 180 mm, P1S/X1C 256 mm cube; flowful maps printer names to beds), slicer exits 0 with no "empty layer" or "floating region" warnings, and zero support material when we claim "no supports needed" (parse slicer stats from the 3MF/G-code).
- A slicer 3MF produced by OrcaSlicer is **not** a Bambu Studio print profile. MakerWorld wants a Bambu Studio 3MF for the "print profile" **[V]**; the raw STL/3MF can go as raw model files.

---

## 3. MakerWorld publishing

Primary sources: [How to upload models](https://wiki.bambulab.com/en/makerworld/tutorials/how-to-upload-models) **[V, fetched]**, [Print profile guidelines](https://wiki.bambulab.com/makerworld/tutorials/print-profile-upload) **[V]**, [Exclusive model guideline](https://wiki.bambulab.com/makerworld/tutorials/exclusive-model-guideline) **[V]**. MakerWorld's own community-guidelines and AI-policy pages blocked my fetch (HTTP 403 / 402 / "page not found"), so AI-policy details below are **[S]** from search summaries of those pages; re-read them manually before relying on them.

### 3.1 Upload flow (web only)
1. Log in at makerworld.com, open the upload page (Creator Center). The Bambu Handy app has **no** upload feature **[V]**.
2. Choose upload type: **Original** or **Remix** (remix needs remixing rights; minor changes are not a remix; describe changes) **[V]**. Third-party import (linked accounts) saves a draft; Printables import is not supported **[V]**.
3. Add files: either a **Bambu Studio 3MF (print profile)** or **raw model files** (STL/CAD/other 3MF) **[V]**. Accepted raw types: 3ds, amf, dwg, dxf, f3d, f3z, factory, fcstd, iges, ipt, obj, ply, py, rsdoc, scad, shape, shapr, skp, sldasm, sldprt, slvs, step, stl, stp, studio3, zip, 3mf, stpz **[V]**. `scad` is accepted, so the parametric source can ship with the model.
4. Fill model information: name, category, **licence**, visibility, description (video via URL), optional Bill of Materials, optional Community Post sync **[V]**. There is an "AI-Generated Content" selection in this section **[S]**.
5. Upload covers (stated as "real print photos") and model pictures **[V]**.
6. Optionally add a print profile (name, pictures, printers). Profiles are verified via MakerWorld **cloud slicing** and per-printer compatibility is checked after publish **[V]**. Models/profiles pass a verification queue; one user reported about an hour for a model with 7 profiles **[S]**.

### 3.2 Required vs optional
| Item | Status | Source |
|---|---|---|
| Model files (profile 3MF or raw files) | Required, at least one of the two | [V] |
| Bambu Studio print profile | **Optional** at upload ("Fill in Print Profile Information (Optional)") | [V] |
| Real photo of a printed result | **Required for any print profile** ("at least one photo of your printed model ... otherwise your print profile may be taken down"; screenshots and AI images do not qualify) | [V] |
| Real printed photo for the model itself | Required since 2026-02-05 per press, "at least one real printed photo matching the uploaded file" | [S: Fabbaloo; Fabbaloo page blocked, forum thread says enforcement is patchy and later switched to automatic image analysis] |
| Cover image | Strongly recommended to be a real photo; AI-render-only covers get "little to no chance of promotion" and misleading renders can be removed with a points penalty | [V-ish: staff post fetched via forum thread 114056 summary] |
| Cover size/ratio | **Not found.** One forum user says 4:3 recommended, no fixed pixel size; collection covers 1:1 | [S, unverified] |
| Licence options | Standard Digital File License and (for exclusive) MakerWorld Exclusive License are certain; a commercial-use variant is mentioned by a third party; **no confirmation of Creative Commons options** | [S/U] |
| Category, tags | Category is required (named in the wiki); tag limits not found | [V category, U tags] |

Practical consequence: every model needs a **physical print** and a **real photo** for covers/profiles. For the automation this means a human-in-the-loop (or the operator's own printer) before publish. Renders are only acceptable as extra pictures/description images, and then labelled.

### 3.3 AI-generated models: policy
- Allowed, not banned. MakerWorld calls generative AI "a tool that assists in 3D modeling" and ships AI tools in MakerLab. [Bambu staff thread](https://forum.bambulab.com/t/our-thoughts-on-the-recent-discussion-regarding-ai-generated-models/114056) **[V via fetch summary]**
- **AIGC label**: creators are asked to tag models that are mostly or entirely AI-generated as "AIGC"; there is an "AI-Generated Content" field in the upload form; an automatic detector also labels MakerLab-tool output; wrong/missing labels can reduce visibility or lead to removal; users can report "Unlabeled AIGC" (effective after 2025-06-29) **[S]** ([wiki ai-policy](https://wiki.bambulab.com/en/makerworld/ai-policy), page currently blocked/moved for me).
- AI-generated **images** are not accepted as model images; they may appear in the description only for illustration **[S]**.
- Unauthorised copying (including AI models built on proprietary designs) is banned: removal and account restrictions **[S]**.
- **Exclusive (cash) programme excludes AI**: guideline text says "AI-generated content, Hueforges, plane/flat/2D models, or models that are clearly not structurally sophisticated will be removed from the program" **[V]**. Also excluded by name: keychains, bookmarks, coasters, fridge magnets, cake toppers, badges, filament clips, box openers, test models, and anything made with MakerLab tools (Parametric Bento Tray Generator, Image to 3D, etc.), plus V2/V3 variations **[V]**. Eligibility needs 100 accumulated prints and only original models **[V]**.
- Points: I found **no official rule** that AIGC-labelled models earn no points **[U]**. The FAQ says points can be revoked or deducted for guideline violations; a user claims unflagged AI will lose points (anecdotal) **[S]**. Contests: community reports of AI slop in contests and requests to ban it; I found no verified official contest ban **[U]**.
- Enforcement is described as report-driven and inconsistent (forum threads), but the risk for an automation is account-level: repeat offenders have all models removed and the account suspended **[V via staff-post summary]**. Creators wrongly labelled can appeal with modelling-process evidence **[V via same summary]**.

### 3.4 Points / rewards / exclusive, briefly
- **MakerReward points**: earned from downloads, prints, ratings, boosts; since June 2025 MakerWorld decides which models receive points rather than paying at fixed milestones **[S, Fabbaloo/All3DP summaries]**. Redeemable in the Points Shop (gift cards, coupons, models, MakerLab credits); regular points have no cash value per the agreement **[S]**. Verify rates on makerworld.com/en/points.
- **Exclusive programme**: model must be removed from all other platforms; needs 100 accumulated prints; standard digital file licence; cash-redeemable "exclusive points" **[V rules, S payout]**. Because it requires exclusivity and rejects AI/simple models, it conflicts with cross-listing. Not a target for this pipeline.
- **Bots**: guidelines prohibit using bots/automation to inflate downloads, prints, boosts, likes, followers **[S]**. Automated *uploading* is not explicitly prohibited in what I saw, but there is **no official API**; only reverse-engineered docs exist (openbambuapi, Bearer JWT, Cloudflare-protected `makerworld.com/api/v1`) **[S]**. Any automation would drive the web UI (Playwright) with ToS and account risk. Recommend: agent prepares a complete upload package (files, title, description, tags, photos checklist) and the operator clicks publish. This also fits the Tier-3 gate.

### 3.5 What gets rejected / taken down
From the print-profile guideline **[V]**: blurry or incomplete photos, failed/unfinished prints, photos from other users or third-party sites, only AI-generated GIFs, wrong process; corrupted or non-printable files, missing needed supports, visible defects; profile not matching model, title or description; colours in photos not matching file; misleading print time; duplicate or split/merged profile collections; trivial changes to existing profiles. From the exclusive guideline **[V]**: AI content, flat models, templated tools, variants. From community guidelines **[S]**: copied or trademark/IP content, misleading renders, AI mislabelling.

---

## 4. Ten models that fit code-CAD, no supports, useful, trademark-clean

All are printable flat-face-down with no supports, parametric in 3-6 variables.

1. **Parametric desk drawer divider/organiser trays** with configurable grid cells and wall thickness.
2. **Gridfinity-style bins and baseplates** with custom compartments (the Gridfinity spec is open, but do not use the word in a way implying endorsement; cad-skill ships a tested generator, licence caveat above). Many existing models, so differentiate by niche sizes.
3. **Cable clips / cable combs** for desk edges, with variable cable diameter and edge thickness.
4. **Headphone hook / under-desk hanger** with screw holes and a parametric clamp variant.
5. **Wall-mount hooks and key racks**, pegboard-compatible (standard 25 mm pitch) with variable hole pattern.
6. **Parametric snap-lid box** with living-hinge-free pin lid, any inner dimensions.
7. **Filament spool holder / spool-side tray** (printed flat in two halves), sized to the AMS-style 200 mm spool.
8. **Phone/tablet stand** with adjustable angle slots (printed on its back; chamfers instead of fillets to avoid supports).
9. **Screw/bit/battery organiser** (AA/AAA/18650 holders, hex-bit holders) with count as a parameter.
10. **Plant pot with drainage tray / self-watering insert**, round and square, scalable diameter (no branded plants or characters).

MakerWorld reality check: the Exclusive guideline lists keychains, coasters, clips, test models and flat items as non-programme, and the platform is flooded with organisers. Differentiators that matter: honest real-photo, a tested Bambu Studio profile, multiple sizes in the same upload, and a clear problem statement in the description **[V, exclusive guideline emphasis on functionality and story]**. No data on what actually sells best; ranking is judgement **[U]**.

---

## 5. Other marketplaces and product types

Ratings are my judgement **[U]**. Fees are as cited. "Automate" means upload without the web UI.

| Channel | What sells | AI policy | Fees | Upload automation | Effort / return |
|---|---|---|---|---|---|
| **Etsy** digital downloads (printables, planners, wall art, SVG cut files) | planners, wall art, stickers, cards, cut files | Allowed but must be disclosed: Creativity Standards classify AI items as "Designed by a seller", disclosure in listing, AI prompts not sellable, digital products explicitly allowed **[S: blog summaries, Etsy page not fetched]** | $0.20 listing (4-month expiry), 6.5% transaction, ~3% + $0.25 processing (US) **[V: [Etsy fees](https://help.etsy.com/hc/en-us/articles/360035902374-Etsy-Fee-Basics), [policy](https://www.etsy.com/legal/fees/)]** | **API**: `createDraftListing` with `type=download`, then `POST /v3/application/shops/{shop_id}/listings/{listing_id}/files` (needs `listings_w` OAuth) **[V: [Etsy listings tutorial](https://developer.etsy.com/documentation/tutorials/listings)]** | Medium effort, highest ceiling, saturated, enforcement on AI is tightening |
| **Gumroad** | any digital file, bundles, presets | Not researched **[U]** | Direct 10% + $0.50 plus processing ~2.9% + $0.30; Discover 30% **[S: [fee guide](https://checkoutpage.com/blog/gumroad-fees)]** | API exists for products **[U, not verified]** | Low effort, little organic traffic unless you bring it |
| **Creative Market** | fonts, templates, graphics | AI label required, shop owners must disclose; ban status unclear **[S: [Creative Market support](https://support.creativemarket.com/hc/en-us/articles/26926388691099-Navigating-Our-New-AI-Label)]** | not researched | Web UI only **[U]** | Curated shop approval, medium |
| **Adobe Stock** | generic stock illustrations/vectors/photos, backgrounds, textures | **Accepted if labelled**: "Created using generative AI tools" checkbox mandatory; people/property fictional checkbox; no artist/real-person/character names in prompts/titles/keywords; not in editorial **[V: [Adobe guidelines](https://helpx.adobe.com/stock/contributor/submit-your-content/submit-generative-ai-content/generative-ai-content-guidelines.html)]** | Adobe takes a revenue share (rate not researched) | Web portal / SFTP upload of files, metadata via CSV embedded **[U]** | Medium effort, slow micro-royalties, volume game, quality bar |
| **Shutterstock / Pond5** | stock | **Contributors may not submit AI content** **[V: [Shutterstock help](https://submit.shutterstock.com/help/en/articles/10594622-content-policy-updates-ai-generated-content)]**; Pond5 same **[S]** | - | - | Skip |
| **Lightroom/Photoshop presets, LUTs** | sell on Etsy/Gumroad, not marketplaces | Presets are not AI "content" in the same way; if made by script, fine **[U]** | via Etsy/Gumroad | via Etsy/Gumroad APIs | Needs genuine photographic skill to not be junk |
| **Fonts** | Creative Market, MyFonts | Not researched **[U]**; AI-generated glyph sets are quality-risky | - | Web UI | High effort per asset, skip |
| **Notion templates / Canva templates** | Gumroad, Etsy, Notion marketplace | Not researched **[U]** | Gumroad/Etsy as above | No API for Notion/Canva marketplaces **[U]** | Low effort per asset; crowded |
| **Stock music** | Epidemic, Pond5, AudioJungle | Pond5 bans AI **[S]**; Envato has an AI-content policy page [Envato](https://help.author.envato.com/hc/en-us/articles/13313674070681-AI-generated-content-policy-for-Market-and-Elements) **[not read]** | - | Web | Skip |
| **Game assets: itch.io** | pixel art, UI packs, icon sets | **AI allowed with mandatory disclosure**; Generative AI tag with sub-tags; untagged AI assets are hidden from browse **[S: [Engadget](https://www.engadget.com/ai/itchio-marketplace-now-requires-asset-creators-to-disclose-their-use-of-generative-ai-130031999.html)]** | itch default revenue share is pay-what-you-want (0-100%) **[U]** | `butler` CLI uploads builds/files **[U, from knowledge]** | Low effort, small revenue |
| **Unity Asset Store** | tools and art packs | AI allowed with transparent disclosure in listing; must not resemble third-party work and must have significant value **[S: [Unity support](https://support.unity.com/hc/en-us/articles/16456407029524-Can-I-publish-and-sell-content-generated-with-AI-on-the-Asset-Store)]**; Cubebrush bans AI (2025) **[S]** | 30% **[U]** | Unity Publisher Portal, web | High quality bar, skip |
| **3D: Printables / Thingiverse / Cults3D / Thangs / MyMiniFactory** | functional models, gadgets, miniatures | Printables: AI models must be tagged, users can hide them **[S]**; Thingiverse: AI label + filter (Jan 2025) **[S: [All3DP](https://all3dp.com/4/thingiverse-adds-ai-labels-lets-users-filter-machine-created-works/)]**; Cults3D: no policy found **[U]**; **MyMiniFactory prohibits AI 3D models and images** **[S: [3DPI](https://3dprintingindustry.com/news/myminifactory-launches-soulcrafted-initiative-to-counter-ai-content-246379/)]**; none of the official pages opened | Cults3D takes a commission on sales **[U]**; others free | Web UI; unofficial Thingiverse API exists **[U]** | One CAD asset, many listings. Revenue is small (mostly free models, donations/premium on Cults3D) |
| **Redbubble / print-on-demand** | art on merch | Not researched **[U]** | margin set by artist | Web UI, some PoD APIs elsewhere **[U]** | Image-only, saturated |
| **KDP low-content / puzzle books** | puzzles, activity, coloring, logbooks | AI-**generated** (not AI-assisted) text/images must be disclosed to Amazon when publishing; disclosure is internal; per-day publishing cap reported at 3 titles; undisclosed titles pulled **[S: [Authors Guild](https://authorsguild.org/news/amazons-new-disclosure-policy-for-ai-generated-book-content-is-a-welcome-first-step/), compliance blogs]** | ~35-70% royalty tiers **[U]** | Web UI only (already solved for coloring books) | Already built; extend to puzzles (sudoku/word search/mazes are deterministic and cheap) |

### Ranked top 5 for a one-person automated pipeline

1. **Etsy digital downloads.** It is the only mainstream marketplace with a documented API that can create download listings and attach files, so the whole path (generate, mock-up, list, tag) can be automated. Must disclose AI, expect label-based friction, and pre-vet each asset for IP. Reuses the coloring-book pages, planners, wall art, and also 3D files as digital downloads.
2. **KDP puzzle/low-content extension.** Zero new infrastructure, deterministic generators (puzzle solvers produce guaranteed-valid content, no "junk" risk), disclosure is a checkbox. Limit: web-UI upload, per-day AI cap.
3. **Own storefront / Gumroad for bundles** (one file set feeds Etsy and this). Cheap, simple, lets us sell 3D files (STL/3MF/scad) that the AI-hostile 3D platforms reject. Traffic must come from Etsy/Pinterest/community, not the platform itself.
4. **Adobe Stock (backgrounds, textures, vector patterns, no people)**. Explicitly accepts labelled AI, but returns per asset are tiny; only worth it as a second use of images already generated for coloring books and wall art. Web/portal upload.
5. **3D cross-listing: Printables + Thingiverse (and Cults3D) first, MakerWorld last.** Same STL/3MF from the text-to-cad pipeline, labelled as AI-assisted/AIGC where required; avoid MyMiniFactory (bans AI); MakerWorld only with the real-photo and manual-publish constraints above. Low revenue, brand-building and print counts; do only after the code-CAD loop proves it yields models that actually print.

Not recommended for this pipeline: Shutterstock/Pond5 (ban), Unity/Cubebrush/stock music (quality bar or ban), fonts and presets (need genuine craft).

---

## Open items to verify manually before building
1. Read MakerWorld's current AI policy and community guidelines in a browser (my fetches were blocked): AIGC label wording, whether points/contests exclude AIGC, the real-photo rule for covers, cover size/ratio, licence list, tag limits.
2. Ask flowful-ai for a commercial licence if its printability loop is wanted.
3. Check text-to-cad's printing DFM reference ([skills/cad/references](https://github.com/earthtojake/text-to-cad/tree/main/skills/cad)) and confirm how to disable telemetry before unattended use.
4. Confirm `openscad --backend=manifold` with the 2026.10.11 snapshot cask via `openscad --help`.
5. Etsy: read the Creativity Standards primary page; Gumroad API, Cults3D, Printables, Redbubble, Canva, Notion, font marketplaces were not researched from primary sources.
