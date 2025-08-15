# Tailwind CSS Rules

## Core Principles
- Use Tailwind CSS utility classes for styling
- Avoid custom CSS unless absolutely necessary
- Maintain consistent order of utility classes
- Follow mobile-first responsive design approach

## Class Organization
- Group related utility classes together (layout, typography, colors, etc.)
- Organize responsive variants in a consistent order (sm, md, lg, xl, 2xl)
- Use consistent spacing between groups of utility classes
- Consider using Tailwind's @apply directive in CSS files for frequently reused combinations

## Responsive Design
- Start with mobile design, then add responsive variants for larger screens
- Use Tailwind's responsive variants (sm:, md:, lg:, xl:, 2xl:) consistently
- Test designs across all breakpoints to ensure proper adaptation
- Consider content-based breakpoints when standard breakpoints are insufficient

## Typography
- Use Tailwind's font-size utilities (text-xs through text-9xl) for consistent scaling
- Apply appropriate line-height utilities for readable text
- Maintain consistent font-weight usage across the application
- Use letter-spacing utilities for headings and specialized text

## Spacing
- Use Tailwind's spacing scale (m-1, p-2, etc.) consistently
- Avoid arbitrary values unless absolutely necessary
- Maintain consistent spacing rhythm throughout interfaces
- Use gap utilities for consistent spacing in flex and grid layouts
- **IMPORTANT**: Avoid using deprecated `space-` utilities; use `gap-` instead for controlling space between elements

## Colors
- Use Tailwind's color palette and opacity modifiers
- Extend the theme with custom colors in tailwind.config.js
- Use semantic color naming in theme extensions
- Apply consistent hover, focus, and active states

## Components
- Build reusable component patterns with consistent Tailwind classes
- Document common component patterns for team reference
- Balance utility composition with component extraction for optimal reuse
- Consider extracting very complex utility combinations into components

## Performance
- Use Tailwind's JIT mode to minimize CSS bundle size
- Purge unused styles in production builds
- Monitor class usage and refactor overly complex utility combinations
- Consider content-visibility and loading optimizations for large pages

## Dark Mode
- Implement dark mode using Tailwind's dark: variant
- Test color contrast in both light and dark modes
- Ensure consistent user experience across modes
- Consider system preference detection for automatic switching

## Accessibility
- Ensure sufficient color contrast using Tailwind's text and background utilities
- Use appropriate text sizes for readability
- Implement focus states with ring utilities
- Test with screen readers to verify accessible markup

## Configuration
- Extend tailwind.config.js for project-specific needs
- Document custom theme extensions
- Implement consistent design tokens for colors, spacing, etc.
- Keep configuration DRY by using JavaScript variables

## Best Practices
- Avoid excessive class strings that become difficult to maintain
- Use Prettier with Tailwind plugin for consistent formatting
- Consider Tailwind CSS IntelliSense extension for development
- Document complex utility patterns with comments
- Stay updated on deprecated utilities and migrate to recommended alternativesAdd prompt contents...