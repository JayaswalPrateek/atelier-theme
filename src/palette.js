// Atelier palette. Every color in the theme comes from here.
//
// Surfaces, darkest to lightest: the editor and all chrome sit on `bg`;
// floating widgets (hover, suggest, peek, notifications) step up through
// bg0..bg4; borders, fills and selections use bg5..bg9.
module.exports = {
  bg: "#000000",
  line: "#070808", // hairline between split editors / panel sections, barely off-black
  sunken: "#131414",
  bg0: "#2a2827",
  bg1: "#2e2c2b",
  bg2: "#32302f",
  bg3: "#373432",
  bg4: "#3a3734",
  bg5: "#3d3835",
  bg6: "#46403d",
  bg7: "#514945",
  bg8: "#5a524c",
  bg9: "#665c54",

  // Chrome text: grey2 for primary, grey1 for secondary, grey0 for inactive.
  grey0: "#7c6f64",
  grey1: "#928374",
  grey2: "#a89984",
  neutral: "#565656", // scrollbar / minimap shadow

  // Content text
  fg0: "#ddc7a1",
  fg: "#d4be98",
  fg1: "#c5b18d",

  // Accents are reserved for meaning (status, diagnostics, syntax), never chrome.
  red: "#ea6962",
  orange: "#e78a4e",
  yellow: "#d8a657",
  green: "#a9b665",
  aqua: "#89b482",
  blue: "#7daea3",
  purple: "#d3869b",
  dimRed: "#b85651",
  dimOrange: "#bd6f3e",
  dimYellow: "#c18f41",
  dimGreen: "#8f9a52",
  dimAqua: "#72966c",
  dimBlue: "#68948a",
  dimPurple: "#ab6c7d",
};
