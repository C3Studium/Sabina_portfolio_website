# sabina-portfolio-concept

A portfolio site for **Sabina Hudrmentová** — photographer and creative. It's the most ambitious thing I've designed so far, and right now that's precisely what it is: a design.

**Stage: in design (Figma). Build comes next.**

There is no production code here yet. The repo holds an untouched `create-next-app` scaffold under
[sabina_personal_portfolio/](sabina_personal_portfolio/) — a parking spot for the build, not an
implementation. Nothing in it was written for this project.

I'm deliberately not rushing into code. The 3D coordinate math is the part I'm respecting enough to
solve before I start typing: how layout maps into camera space, how type and geometry stay in
agreement across viewports, how scroll drives a scene rather than a page. Get that wrong early and
you spend the rest of the build fighting it.

## Design principles

**Play with perception.** The site should make you unsure, for a second, what you're looking at —
depth that reads flat, flatness that turns out to have depth, motion that resolves into something
still. Photography is about controlling how someone sees; the site should behave the same way.

**Grayscale and vibrant color, side by side.** Not a theme toggle and not a phase transition — both
registers present at once, in tension. Grayscale sets the baseline so color lands as an event.

**Typography does the heavy lifting.** Type is the primary structure, not a caption layer over
imagery. Large, confident, load-bearing — it holds the composition even where the 3D drops out.

**3D is structure, not garnish.** WebGL and shaders are how the space is built, not an effect
sprinkled on top. If a scene doesn't change how the page is read, it doesn't ship.

**It has to survive contact with a real browser.** Ambition is a design decision; jank is a bug.
Every perceptual idea needs a fallback that still looks intentional.

## Prototype

**Figma (design file + interactive prototype):**
[Momentální Projekt → node 3053-41](https://www.figma.com/design/dL1RAWsbxKeh4yrPpZQPyW/Moment%C3%A1ln%C3%AD-Projekt?node-id=3053-41)

The Figma prototype is the source of truth for the concept right now. Screenshots go here once the
key frames are locked — placeholders, nothing captured yet:

<!-- ![Landing](docs/screens/landing.png) -->
<!-- ![Work index](docs/screens/work-index.png) -->
<!-- ![Case view](docs/screens/case-view.png) -->
<!-- ![Color / grayscale pairing](docs/screens/color-pairing.png) -->

## Planned stack

Intentions, not commitments — none of this is validated in code yet, and the 3D layer in particular
is still an open question I expect to prototype before deciding.

| Layer | Plan |
| --- | --- |
| Framework | Next.js + TypeScript (scaffolded, untouched) |
| 3D / WebGL | Three.js, likely via React Three Fiber |
| Shaders | Hand-written GLSL for the perception and color work |
| Motion | Scroll-driven scene state; smooth-scroll + timeline library TBD |
| Styling | CSS Modules or similar — undecided, and low-stakes either way |
| Media | Next.js image pipeline, with attention to color fidelity |
| Hosting | Vercel |

Open questions I want answered before the build: mobile strategy for the 3D layer, the no-WebGL
fallback, and the real performance budget for shader work on mid-range hardware.
