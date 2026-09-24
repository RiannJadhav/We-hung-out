import { rgb } from "pdf-lib";

// Placeholder "photo" slots stand in for real photos during this build
// stage (no camera-roll access or AI selection wired up yet -- see the
// product spec's Stage 1-4 pipeline for what eventually fills these).
// Each placeholder is just a colored rect + label so you can see the
// panel grid, rotation and primitives working correctly without needing
// real images.
function slot(label, hex, textHex = "#ffffff") {
  return { label, color: hexColor(hex), textColor: hexColor(textHex) };
}

function hexColor(hex) {
  const n = hex.replace("#", "");
  const r = parseInt(n.substring(0, 2), 16) / 255;
  const g = parseInt(n.substring(2, 4), 16) / 255;
  const b = parseInt(n.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

// A believable "night" for a college hangout: pre-game, dinner, the
// street, a dance floor, a funny mishap, a quiet moment, the group
// photo, the walk home. Same underlying "moments" are used for both
// style demos below, but each style picks different primitives/density
// for them -- exactly what the product spec asks a style to do.

const PALETTE = {
  cover: "#1d2b3a",
  establishing1: "#3a4750",
  establishing2: "#5c6b73",
  establishing3: "#8d9a9c",
  portrait1: "#a4243b",
  portrait2: "#d8973c",
  hero: "#bd4f6c",
  funny1: "#e8c547",
  funny2: "#e0b03e",
  candid: "#5c8001",
  group1: "#25a18e",
  group2: "#177e89",
  group3: "#3ec1d3",
  closing: "#0b132b",
  contact1: "#264653",
  contact2: "#2a9d8f",
  contact3: "#e9c46a",
  contact4: "#f4a261",
  contact5: "#e76f51",
  contact6: "#5c4d7d",
};

export const DOCUMENTARY_ZINE = [
  {
    primitive: "HERO_IMAGE",
    photos: [slot("Cover", PALETTE.cover)],
    caption: "We hung out -- Sat 20 Sep, 7:04pm",
  },
  {
    primitive: "THREE_UP",
    photos: [
      slot("Street", PALETTE.establishing1),
      slot("Menu", PALETTE.establishing2),
      slot("Table", PALETTE.establishing3),
    ],
    caption: "Getting there",
  },
  {
    primitive: "TWO_UP",
    photos: [slot("Riya laughing", PALETTE.portrait1), slot("Dev mid-sentence", PALETTE.portrait2)],
    caption: "Who was there",
  },
  {
    primitive: "HERO_IMAGE",
    photos: [slot("The toast", PALETTE.hero)],
    caption: "9:41pm",
  },
  {
    primitive: "ASYMMETRIC_PAIR",
    photos: [slot("Spilled drink", PALETTE.funny1), slot("Reaction", PALETTE.funny2)],
    caption: "It happened fast",
  },
  {
    primitive: "IMAGE_WITH_CAPTION",
    photos: [slot("Quiet outside", PALETTE.candid)],
    caption: "10:52pm, stepped out for air",
  },
  {
    primitive: "FOUR_GRID",
    photos: [
      slot("Group 1", PALETTE.group1),
      slot("Group 2", PALETTE.group2),
      slot("Group 3", PALETTE.group3),
      slot("Group 4", PALETTE.contact6),
    ],
    caption: "Before we split up",
  },
  {
    primitive: "IMAGE_WITH_CAPTION",
    photos: [slot("Walk home", PALETTE.closing)],
    caption: "11:58pm -- Bandra",
  },
];

export const SCRAPBOOK_ZINE = [
  {
    primitive: "FULL_BLEED",
    photos: [slot("Cover", PALETTE.cover)],
    caption: "we hung out :)",
  },
  {
    primitive: "CONTACT_SHEET",
    photos: [
      slot("1", PALETTE.contact1),
      slot("2", PALETTE.contact2),
      slot("3", PALETTE.contact3),
      slot("4", PALETTE.contact4),
      slot("5", PALETTE.contact5),
      slot("6", PALETTE.contact6),
    ],
    caption: "the whole roll",
  },
  {
    primitive: "PORTRAIT_STACK",
    photos: [slot("Riya", PALETTE.portrait1), slot("Dev", PALETTE.portrait2), slot("Both", PALETTE.hero)],
    caption: "the usual suspects",
  },
  {
    primitive: "FULL_BLEED",
    photos: [slot("The toast", PALETTE.hero)],
    caption: "!!!",
  },
  {
    primitive: "TWO_UP",
    photos: [slot("Spilled drink", PALETTE.funny1), slot("Reaction", PALETTE.funny2)],
    caption: "lol",
  },
  {
    primitive: "ASYMMETRIC_PAIR",
    photos: [slot("Quiet outside", PALETTE.candid), slot("Streetlight", PALETTE.establishing1)],
    caption: "needed air",
  },
  {
    primitive: "FOUR_GRID",
    photos: [
      slot("Group 1", PALETTE.group1),
      slot("Group 2", PALETTE.group2),
      slot("Group 3", PALETTE.group3),
      slot("Group 4", PALETTE.contact6),
    ],
    caption: "everyone",
  },
  {
    primitive: "FULL_BLEED",
    photos: [slot("Walk home", PALETTE.closing)],
    caption: "goodnight",
  },
];
