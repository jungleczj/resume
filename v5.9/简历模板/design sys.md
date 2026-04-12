# Design System Specification: High-End Editorial

 

## 1. Overview & Creative North Star

**Creative North Star: The Architectural Curator**

This design system is built to move beyond the "template" aesthetic of standard resumes. It treats the professional profile as a curated editorial piece rather than a data entry form. By utilizing intentional asymmetry, high-contrast typography, and deep tonal layering, we create an experience that feels authoritative, bespoke, and permanent. 

 

The goal is to provide a "Digital Portfolio" feel that balances the heritage of Noto Serif with the precision of Inter. We break the rigid grid by using expansive margins and "floating" content blocks that guide the eye through a candidate’s career narrative with rhythmic intention.

 

---

 

## 2. Colors & Surface Philosophy

The palette is anchored in deep, authoritative navies and charcoal grays, punctuated by professional accent blues.

 

### The "No-Line" Rule

To achieve a premium, editorial feel, **designers are prohibited from using 1px solid borders for sectioning.** Structural boundaries must be defined solely through background color shifts or subtle tonal transitions.

- Use `surface-container-low` (#f3f3f6) sections against a `surface` (#f9f9fc) background to define distinct content areas (e.g., a sidebar or a header block).

 

### Surface Hierarchy & Nesting

Treat the UI as a series of physical layers. Use the surface-container tiers to create nested depth:

- **Level 0 (Base):** `surface` (#f9f9fc)

- **Level 1 (Sections):** `surface-container-low` (#f3f3f6)

- **Level 2 (Cards/Interaction):** `surface-container-lowest` (#ffffff) to provide a soft "lift."

 

### Signature Textures & Gradients

Standard flat fills can feel clinical. For primary Call-to-Actions (CTAs) or major section headers, use a subtle linear gradient:

- **Direction:** 135 degrees.

- **From:** `primary` (#000e24) 

- **To:** `primary_container` (#00234b).

This adds "soul" and depth to the deep navy, mimicking the sheen of high-quality ink.

 

---

 

## 3. Typography

Typography is the primary vehicle for the brand’s professional identity. We pair the intellectual weight of **Noto Serif** with the functional clarity of **Inter**.

 

- **Display & Headlines (Noto Serif):** Used for candidate names and major section titles (e.g., "Experience," "Education"). The Serif conveys tradition, wisdom, and high-level seniority.

- **Titles & Labels (Inter):** Used for job titles, dates, and navigation. Inter provides a technical, modern edge that suggests efficiency.

- **Body (Inter):** Optimized for high readability. Use `body-md` (0.875rem) for descriptions to maintain an elegant, slightly smaller-than-average "executive" type size.

 

**Hierarchy Tip:** Always maintain a significant scale jump between `headline-lg` and `title-md`. This intentional gap creates the editorial "wow" factor.

 

---

 

## 4. Elevation & Depth

We eschew traditional shadows in favor of **Tonal Layering**.

 

- **The Layering Principle:** Place a `surface-container-lowest` (#ffffff) card on top of a `surface-container-high` (#e8e8ea) background. This creates a natural "step" in depth without the need for visual noise.

- **Ambient Shadows:** If a floating element (like a modal or floating menu) is required, use a shadow with a 24px-32px blur, set to 4% opacity, using the `on_surface` color as the tint.

- **The "Ghost Border" Fallback:** If a boundary is required for accessibility, use the `outline_variant` (#c4c6d0) at **15% opacity**. This creates a "suggestion" of a line rather than a hard break.

- **Glassmorphism:** For sticky headers or contact bars, use `surface_bright` (#f9f9fc) with an 80% opacity and a `backdrop-filter: blur(12px)`. This integrates the content into the background rather than sitting it "on top."

 

---

 

## 5. Components

 

### Buttons

- **Primary:** Gradient fill (`primary` to `primary_container`), `on_primary` text, roundedness `md` (0.375rem). 

- **Secondary:** `surface_container_high` fill with `primary` text. No border.

- **Tertiary:** Text-only using `tertiary_fixed_variant` (#0035be) for a professional accent.

 

### Chips (Skills & Tags)

- Use `secondary_container` (#d2e2ee) for the background and `on_secondary_container` (#55656f) for text.

- **Shape:** Use `full` (9999px) roundedness to contrast against the architectural squareness of the layout.

 

### Experience Cards & Lists

- **Strictly forbid divider lines.**

- Separate career entries using `2rem` of vertical white space (derived from the spacing scale).

- Use `surface-container-low` for the "active" or "featured" experience entry to give it prominence.

 

### Input Fields (Forms)

- **Style:** "Underline-only" or "Soft Fill."

- Use `surface_container_highest` (#e2e2e5) for the field background with a `sm` (0.125rem) bottom-only border using `outline`. This mimics the feel of a high-end physical form.

 

### Skill Progress Indicators

- Instead of standard bars, use a series of small, `sm` rounded squares. 

- Filled: `primary`. Unfilled: `surface_container_highest`.

 

---

 

## 6. Do’s and Don'ts

 

### Do:

- **Embrace Asymmetry:** Place the candidate's name and contact info in a 1/3 vs 2/3 layout to create visual interest.

- **Use "Tonal Contrast":** Make sure that text on `surface-container-highest` uses `on_surface` for maximum WCAG compliance.

- **Generous Leading:** Increase line-height for `body-lg` to 1.6 or 1.7 to allow the text to "breathe."

 

### Don’t:

- **Don’t use 100% Black:** Always use `on_surface` (#1a1c1e) for text. Pure black is too harsh for high-end editorial.

- **Don’t Over-Round:** Stick to `sm` and `md` corners for most elements. `full` roundedness should be reserved for small UI accents like chips or status dots.

- **Don’t Crowd the Margins:** High-end resumes require significant "padding-inline." Ensure the content is never closer than 40px to the edge of the viewport/page.