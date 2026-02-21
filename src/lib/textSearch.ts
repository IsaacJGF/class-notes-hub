const ACCENT_GROUPS: Record<string, string[]> = {
  a: ["a", "á", "à", "â", "ã"],
  e: ["e", "é", "è", "ê", "ẽ"],
  i: ["i", "í", "ì", "î", "ĩ"],
  o: ["o", "ó", "ò", "ô", "õ"],
  u: ["u", "ú", "ù", "û", "ũ"],
};

const VARIANT_TO_BASE = Object.entries(ACCENT_GROUPS).reduce<Record<string, string>>((acc, [base, variants]) => {
  variants.forEach((variant) => {
    if (variant !== base) acc[variant] = base;
  });
  return acc;
}, {});

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildAccentAwarePattern = (query: string) => {
  return [...query]
    .map((char) => {
      const normalizedChar = char.toLowerCase();

      if (ACCENT_GROUPS[normalizedChar]) {
        return `[${ACCENT_GROUPS[normalizedChar].join("")}]`;
      }

      if (VARIANT_TO_BASE[normalizedChar]) {
        return escapeRegExp(char);
      }

      return escapeRegExp(char);
    })
    .join("");
};

export const matchesAccentAware = (value: string, query: string) => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return true;

  const pattern = buildAccentAwarePattern(trimmedQuery);
  return new RegExp(pattern, "iu").test(value);
};
