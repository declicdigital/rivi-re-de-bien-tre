export const NAV = [
  {
    label: "Soins",
    children: [
      { label: "Madérothérapie", target: "maderotherapie", desc: "Massage aux outils en bois" },
      { label: "Kobido", target: "kobido", desc: "Lifting naturel japonais du visage" },
      { label: "Massage fascial", target: "a-propos", desc: "Libérer les tensions profondes" },
    ],
  },
  { label: "À propos", target: "a-propos" },
  { label: "Tarifs", target: "contact" },
  { label: "Contact", target: "contact" },
] as const;
