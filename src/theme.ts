import {
  AppShell,
  Button,
  Card,
  Checkbox,
  NavLink,
  Radio,
  SegmentedControl,
  Switch,
  createTheme,
  v8CssVariablesResolver,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core';
import './theme.css';

// Petrol with a red accent (decision D9). Stops 0, 1, 6-9 come from the approved mockup.
const petrol: MantineColorsTuple = [
  '#e7f2f6',
  '#cfe4ec',
  '#a6d7e8',
  '#7cc3dc',
  '#4fabcc',
  '#2e96ba',
  '#0f6e8f',
  '#0b5f7c',
  '#094f68',
  '#073f53',
];

// Sparing second accent (required-field asterisk). Stop 6 is #c9463d.
const signal: MantineColorsTuple = [
  '#fbeceb',
  '#f6d5d2',
  '#f0b5b0',
  '#f08a80',
  '#e2675d',
  '#d4554b',
  '#c9463d',
  '#b23a31',
  '#962f28',
  '#7a2520',
];

export const theme = createTheme({
  colors: { petrol, signal },
  primaryColor: 'petrol',
  // Stop 6 (#0f6e8f) carries white button text at 5.6:1; dark scheme: see cssVariablesResolver.
  primaryShade: { light: 6, dark: 6 },
  // Mantine 9 changed these defaults (radius sm -> md, medium weight 500 -> 600): keep the
  // Mantine 8 look. Buttons were 600 in Mantine 8 and keep it via .bogen-button (theme.css).
  defaultRadius: 'sm',
  fontWeights: { medium: '500' },
  // Mantine 9 gives buttons, links, chips etc. the theme cursor (default: 'default'); Mantine 8
  // hard-coded pointer there and used the default cursor only for checkbox, radio and switch.
  cursorType: 'pointer',
  components: {
    AppShell: AppShell.extend({
      classNames: { header: 'bogen-header', navbar: 'bogen-navbar' },
    }),
    NavLink: NavLink.extend({ classNames: { root: 'bogen-nav-link' } }),
    Card: Card.extend({ classNames: { root: 'bogen-card' } }),
    Button: Button.extend({ classNames: { root: 'bogen-button' } }),
    Checkbox: Checkbox.extend({ classNames: { root: 'bogen-cursor-default' } }),
    Radio: Radio.extend({ classNames: { root: 'bogen-cursor-default' } }),
    Switch: Switch.extend({ classNames: { root: 'bogen-cursor-default' } }),
    SegmentedControl: SegmentedControl.extend({
      classNames: { indicator: 'bogen-sc-radius', label: 'bogen-sc-radius' },
    }),
  },
});

/** Filled primary (buttons etc.) in the dark scheme, as in the mockup. White text: 4.88:1. */
export const DARK_PRIMARY_FILLED = '#127a9e';

// Base: Mantine 8 colour variables (the 9.x `light` variant is opaque; 8.x was translucent,
// which the light buttons, badges and alerts were designed with).
export const cssVariablesResolver: CSSVariablesResolver = (mantineTheme) => {
  const base = v8CssVariablesResolver(mantineTheme);
  return {
    ...base,
    dark: {
      ...base.dark,
      '--mantine-color-petrol-filled': DARK_PRIMARY_FILLED,
      '--mantine-color-petrol-filled-hover': '#0f6e8f',
    },
  };
};
