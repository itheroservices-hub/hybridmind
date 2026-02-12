/**
 * HybridMind Design System
 * Modern, minimalistic design with #0b6a76 brand color
 * 
 * Design Principles:
 * - Clean, spacious layouts
 * - Consistent typography hierarchy
 * - Accessible color contrast
 * - Smooth animations
 * - Responsive components
 */

export const designSystem = {
  // Brand Colors
  colors: {
    // Primary Brand Color
    primary: '#0b6a76',
    primaryHover: '#0a5a65',
    primaryActive: '#084a54',
    primaryLight: '#0d7d8b',
    primaryPale: 'rgba(11, 106, 118, 0.1)',
    
    // Accent Colors
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    
    // Tier Badges
    tierFree: '#10b981',
    tierPro: '#3b82f6',
    tierProPlus: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
    
    // Neutral Colors (use CSS vars for theme support)
    background: 'var(--vscode-editor-background)',
    foreground: 'var(--vscode-foreground)',
    border: 'var(--vscode-panel-border)',
    hover: 'var(--vscode-list-hoverBackground)',
  },

  // Typography
  typography: {
    fontFamily: 'var(--vscode-font-family)',
    fontSize: {
      xs: '10px',
      sm: '11px',
      base: '13px',
      lg: '14px',
      xl: '16px',
      '2xl': '18px',
      '3xl': '24px'
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75
    }
  },

  // Spacing (8px base unit)
  spacing: {
    0: '0',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px'
  },

  // Border Radius
  borderRadius: {
    sm: '3px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    full: '9999px'
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 2px 8px rgba(0, 0, 0, 0.1)',
    lg: '0 4px 12px rgba(0, 0, 0, 0.15)',
    xl: '0 8px 24px rgba(0, 0, 0, 0.2)',
    brand: '0 4px 12px rgba(11, 106, 118, 0.3)'
  },

  // Transitions
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    base: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '350ms cubic-bezier(0.4, 0, 0.2, 1)'
  },

  // Z-Index
  zIndex: {
    base: 1,
    dropdown: 10,
    sticky: 20,
    modal: 30,
    popover: 40,
    tooltip: 50
  }
};

/**
 * Generate CSS for the design system
 */
export function getDesignSystemCSS(): string {
  const ds = designSystem;
  
  return `
/* ============================================================================
   HYBRIDMIND DESIGN SYSTEM - Modern, Minimalistic, Accessible
   Brand Color: #0b6a76
   ============================================================================ */

/* Reset & Base Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: ${ds.typography.fontFamily};
  font-size: ${ds.typography.fontSize.base};
  line-height: ${ds.typography.lineHeight.normal};
  color: ${ds.colors.foreground};
  background: ${ds.colors.background};
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Typography Hierarchy */
.text-xs { font-size: ${ds.typography.fontSize.xs}; }
.text-sm { font-size: ${ds.typography.fontSize.sm}; }
.text-base { font-size: ${ds.typography.fontSize.base}; }
.text-lg { font-size: ${ds.typography.fontSize.lg}; }
.text-xl { font-size: ${ds.typography.fontSize.xl}; }
.text-2xl { font-size: ${ds.typography.fontSize['2xl']}; }
.text-3xl { font-size: ${ds.typography.fontSize['3xl']}; }

.font-normal { font-weight: ${ds.typography.fontWeight.normal}; }
.font-medium { font-weight: ${ds.typography.fontWeight.medium}; }
.font-semibold { font-weight: ${ds.typography.fontWeight.semibold}; }
.font-bold { font-weight: ${ds.typography.fontWeight.bold}; }

/* Spacing Utilities */
.space-y-1 > * + * { margin-top: ${ds.spacing[1]}; }
.space-y-2 > * + * { margin-top: ${ds.spacing[2]}; }
.space-y-3 > * + * { margin-top: ${ds.spacing[3]}; }
.space-y-4 > * + * { margin-top: ${ds.spacing[4]}; }
.space-y-6 > * + * { margin-top: ${ds.spacing[6]}; }

.p-1 { padding: ${ds.spacing[1]}; }
.p-2 { padding: ${ds.spacing[2]}; }
.p-3 { padding: ${ds.spacing[3]}; }
.p-4 { padding: ${ds.spacing[4]}; }
.p-6 { padding: ${ds.spacing[6]}; }

.px-2 { padding-left: ${ds.spacing[2]}; padding-right: ${ds.spacing[2]}; }
.px-3 { padding-left: ${ds.spacing[3]}; padding-right: ${ds.spacing[3]}; }
.px-4 { padding-left: ${ds.spacing[4]}; padding-right: ${ds.spacing[4]}; }

.py-2 { padding-top: ${ds.spacing[2]}; padding-bottom: ${ds.spacing[2]}; }
.py-3 { padding-top: ${ds.spacing[3]}; padding-bottom: ${ds.spacing[3]}; }
.py-4 { padding-top: ${ds.spacing[4]}; padding-bottom: ${ds.spacing[4]}; }

/* Modern Button System */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${ds.spacing[2]};
  padding: ${ds.spacing[2]} ${ds.spacing[4]};
  font-size: ${ds.typography.fontSize.sm};
  font-weight: ${ds.typography.fontWeight.medium};
  border-radius: ${ds.borderRadius.md};
  border: none;
  cursor: pointer;
  transition: all ${ds.transitions.base};
  white-space: nowrap;
  user-select: none;
}

.btn-primary {
  background: ${ds.colors.primary};
  color: white;
}

.btn-primary:hover {
  background: ${ds.colors.primaryHover};
  transform: translateY(-1px);
  box-shadow: ${ds.shadows.brand};
}

.btn-primary:active {
  background: ${ds.colors.primaryActive};
  transform: translateY(0);
}

.btn-secondary {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}

.btn-secondary:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}

.btn-ghost {
  background: transparent;
  color: ${ds.colors.foreground};
  border: 1px solid ${ds.colors.border};
}

.btn-ghost:hover {
  background: ${ds.colors.hover};
  border-color: ${ds.colors.primary};
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

.btn-sm {
  padding: ${ds.spacing[1]} ${ds.spacing[3]};
  font-size: ${ds.typography.fontSize.xs};
}

.btn-lg {
  padding: ${ds.spacing[3]} ${ds.spacing[6]};
  font-size: ${ds.typography.fontSize.base};
}

/* Card System */
.card {
  background: var(--vscode-sideBar-background);
  border: 1px solid ${ds.colors.border};
  border-radius: ${ds.borderRadius.md};
  padding: ${ds.spacing[4]};
  transition: all ${ds.transitions.base};
}

.card-hover:hover {
  border-color: ${ds.colors.primary};
  box-shadow: ${ds.shadows.md};
  transform: translateY(-2px);
}

.card-primary {
  border-left: 3px solid ${ds.colors.primary};
}

.card-success {
  border-left: 3px solid ${ds.colors.success};
}

.card-warning {
  border-left: 3px solid ${ds.colors.warning};
}

.card-error {
  border-left: 3px solid ${ds.colors.error};
}

/* Badge System */
.badge {
  display: inline-flex;
  align-items: center;
  padding: ${ds.spacing[1]} ${ds.spacing[2]};
  font-size: ${ds.typography.fontSize.xs};
  font-weight: ${ds.typography.fontWeight.semibold};
  border-radius: ${ds.borderRadius.sm};
  white-space: nowrap;
}

.badge-primary {
  background: ${ds.colors.primaryPale};
  color: ${ds.colors.primary};
}

.badge-success {
  background: ${ds.colors.success};
  color: white;
}

.badge-warning {
  background: ${ds.colors.warning};
  color: white;
}

.badge-error {
  background: ${ds.colors.error};
  color: white;
}

.badge-tier-free {
  background: ${ds.colors.tierFree};
  color: white;
}

.badge-tier-pro {
  background: ${ds.colors.tierPro};
  color: white;
}

.badge-tier-pro-plus {
  background: ${ds.colors.tierProPlus};
  color: white;
}

/* Input System */
.input {
  width: 100%;
  padding: ${ds.spacing[2]} ${ds.spacing[3]};
  font-family: ${ds.typography.fontFamily};
  font-size: ${ds.typography.fontSize.sm};
  color: var(--vscode-input-foreground);
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border);
  border-radius: ${ds.borderRadius.md};
  transition: all ${ds.transitions.base};
}

.input:focus {
  outline: none;
  border-color: ${ds.colors.primary};
  box-shadow: 0 0 0 3px ${ds.colors.primaryPale};
}

.input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.textarea {
  resize: vertical;
  min-height: 80px;
  max-height: 200px;
  font-family: ${ds.typography.fontFamily};
}

/* Select System */
.select {
  width: 100%;
  padding: ${ds.spacing[2]} ${ds.spacing[3]};
  font-size: ${ds.typography.fontSize.sm};
  color: var(--vscode-dropdown-foreground);
  background: var(--vscode-dropdown-background);
  border: 1px solid var(--vscode-dropdown-border);
  border-radius: ${ds.borderRadius.md};
  cursor: pointer;
  transition: all ${ds.transitions.base};
}

.select:hover {
  border-color: ${ds.colors.primary};
}

.select:focus {
  outline: none;
  border-color: ${ds.colors.primary};
  box-shadow: 0 0 0 3px ${ds.colors.primaryPale};
}

/* Checkbox/Radio System */
.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: ${ds.spacing[2]};
  cursor: pointer;
  padding: ${ds.spacing[2]};
  border-radius: ${ds.borderRadius.sm};
  transition: background ${ds.transitions.fast};
}

.checkbox-wrapper:hover {
  background: ${ds.colors.hover};
}

.checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: ${ds.colors.primary};
}

/* Modern Grid System */
.grid {
  display: grid;
  gap: ${ds.spacing[3]};
}

.grid-cols-2 {
  grid-template-columns: repeat(2, 1fr);
}

.grid-cols-3 {
  grid-template-columns: repeat(3, 1fr);
}

.grid-cols-4 {
  grid-template-columns: repeat(4, 1fr);
}

/* Flex Utilities */
.flex {
  display: flex;
}

.flex-col {
  flex-direction: column;
}

.items-center {
  align-items: center;
}

.justify-between {
  justify-content: space-between;
}

.justify-center {
  justify-content: center;
}

.gap-1 { gap: ${ds.spacing[1]}; }
.gap-2 { gap: ${ds.spacing[2]}; }
.gap-3 { gap: ${ds.spacing[3]}; }
.gap-4 { gap: ${ds.spacing[4]}; }

/* Animation System */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(${ds.spacing[2]});
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.animate-slide-in {
  animation: slideIn ${ds.transitions.base};
}

.animate-fade-in {
  animation: fadeIn ${ds.transitions.fast};
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.3);
  border-radius: ${ds.borderRadius.full};
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(128, 128, 128, 0.5);
}

/* Accessibility */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* Focus Visible */
*:focus-visible {
  outline: 2px solid ${ds.colors.primary};
  outline-offset: 2px;
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;
}
