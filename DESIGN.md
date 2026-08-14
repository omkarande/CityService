---
name: Urban Discovery System
colors:
  surface: '#faf9ff'
  surface-dim: '#ccdaff'
  surface-bright: '#faf9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e1e8ff'
  surface-container-highest: '#d8e2ff'
  on-surface: '#051a3e'
  on-surface-variant: '#434654'
  inverse-surface: '#1d3054'
  inverse-on-surface: '#edf0ff'
  outline: '#737685'
  outline-variant: '#c3c6d6'
  surface-tint: '#0c56d0'
  primary: '#003d9b'
  on-primary: '#ffffff'
  primary-container: '#0052cc'
  on-primary-container: '#c4d2ff'
  inverse-primary: '#b2c5ff'
  secondary: '#994700'
  on-secondary: '#ffffff'
  secondary-container: '#fb7800'
  on-secondary-container: '#592600'
  tertiary: '#004b59'
  on-tertiary: '#ffffff'
  tertiary-container: '#006477'
  on-tertiary-container: '#76e2ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b2c5ff'
  on-primary-fixed: '#001848'
  on-primary-fixed-variant: '#0040a2'
  secondary-fixed: '#ffdbc8'
  secondary-fixed-dim: '#ffb68b'
  on-secondary-fixed: '#321200'
  on-secondary-fixed-variant: '#753400'
  tertiary-fixed: '#afecff'
  tertiary-fixed-dim: '#48d7f9'
  on-tertiary-fixed: '#001f27'
  on-tertiary-fixed-variant: '#004e5d'
  background: '#faf9ff'
  on-background: '#051a3e'
  surface-variant: '#d8e2ff'
typography:
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-bold:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style

The design system is built for a clean, modern service discovery platform tailored for the Indian urban landscape. The brand personality is **reliable**, **efficient**, and **vibrant**, reflecting the fast-paced nature of city life. 

The aesthetic leans into **Corporate Modernism** with a touch of **Glassmorphism** for depth. It prioritizes clarity and utility, ensuring that users can quickly navigate between city selections, map views, and service availability. The emotional response should be one of confidence and ease—knowing that the services they need are just a tap away.

The UI avoids clutter, using generous whitespace and high-contrast elements to guide the user's eye toward status indicators and action buttons.

## Colors

The color palette uses a professional **Deep Blue (Primary)** to establish trust and reliability, paired with a vibrant **Safety Orange (Secondary)** used specifically for status indicators, availability alerts, and calls to action. 

- **Primary Blue:** Navigation, headers, and primary interaction states.
- **Secondary Orange:** Highlights, "Live" status, and limited-time offers.
- **Tertiary Teal:** Used for secondary service categories and map markers.
- **Neutral:** A deep slate for typography and borders, ensuring high legibility against the stark white backgrounds.

Semantic colors (Success: #36B37E, Warning: #FFAB00, Error: #FF5630) are used sparingly for real-time service feedback.

## Typography

This design system utilizes **Manrope** for headlines to provide a modern, geometric, and authoritative feel. **Plus Jakarta Sans** is used for body text and labels, offering a softer, more welcoming touch that improves readability in dense service lists.

Hierarchy is maintained through weight rather than just size. Headlines use Bold or Semibold weights, while functional labels use Medium or Bold at smaller sizes to ensure they don't get lost in the layout. Letter spacing is slightly tightened on headlines to create a more "compact" and premium editorial look.

## Layout & Spacing

The layout follows a **Fluid Grid** system based on an 8px spacing rhythm. 

- **Mobile:** A 4-column grid with 16px margins and 16px gutters.
- **Desktop:** A 12-column grid with 48px margins and 24px gutters.

Components like the city cards and service lists use the `lg` (24px) spacing for vertical separation to maintain a clean, airy feel. The "City Card" section should wrap horizontally on mobile but can expand to a multi-row grid on tablet/desktop. The service list occupies the primary column space, with the map view either docked at the top (mobile) or floating in a side panel (desktop).

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and **Ambient Shadows**.

1.  **Level 0 (Surface):** The main background uses a light grey-blue tint (#F4F7F9) to reduce eye strain.
2.  **Level 1 (Cards):** City cards and service list items use a pure white background with a very soft, diffused shadow (0px 4px 12px rgba(9, 30, 66, 0.08)).
3.  **Level 2 (Search/Dialogs):** The primary search bar and action menus use a higher elevation with a more pronounced shadow and a subtle 1px border (#DFE1E6) to separate them from the content beneath.

Backdrop blurs (Glassmorphism) are reserved for the bottom navigation bar and sticky headers to maintain context of the content scrolling underneath.

## Shapes

The design system uses a **Rounded** shape language to appear approachable and modern. 

- **City Cards:** These are "rounded squares" (1:1 ratio) with a 1rem corner radius. 
- **Search Bar:** Uses a pill-shaped radius (2rem) to distinguish it as the primary entry point.
- **Service Status Indicators:** Small badges and chips use a 0.5rem radius.
- **Platform Logos:** Contained within rounded-square containers (0.5rem) to ensure consistency regardless of the original logo's shape.

## Components

### Search Bar
A sleek, full-width bar with a 2rem radius. It includes a left-aligned location icon (Primary Blue) and a right-aligned "Current Location" button.

### City Cards
Square-format cards containing a city silhouette or representative icon. The background is a soft blue tint, with the city name (Headline-MD) centered.

### Service List Items
Horizontal rows containing:
1.  **Platform Logo:** A 48px square container with a soft border.
2.  **Details:** Service name (Body-LG) and estimated time (Body-MD).
3.  **Status Indicator:** A "Live" badge (Secondary Orange) or "Available" indicator.
4.  **CTA:** A chevron or "Book" button.

### Progress/Availability Bars
Linear bars used to indicate how "busy" a service area is. These use the Primary Blue for the base and Secondary Orange for peak alerts.

### Floating Action Button (FAB)
A circular button with a "+" icon, used for the "Add Service" function as seen in the sketch, positioned at the bottom right.