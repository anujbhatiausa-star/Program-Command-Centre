export type Role = "pm" | "ba" | "sponsor" | "product_owner";

export const ROLE_LABEL: Record<Role, string> = {
  pm: "Delivery lead (Algoworks PM)",
  ba: "Business analyst (Algoworks)",
  sponsor: "Executive sponsor (Customer)",
  product_owner: "Product owner (Customer)",
};

/** Which roles may open each page. Enforced server-side in every page and route. */
export const PAGES: { href: string; label: string; roles: Role[] }[] = [
  { href: "/", label: "Overview", roles: ["pm", "sponsor", "product_owner"] },
  { href: "/billing", label: "Billing", roles: ["pm", "sponsor", "product_owner"] },
  { href: "/board", label: "Backlog & board", roles: ["pm", "ba"] },
  { href: "/acceptance", label: "Acceptance queue", roles: ["product_owner", "pm"] },
  { href: "/releases", label: "Release readiness", roles: ["pm", "ba", "sponsor", "product_owner"] },
  { href: "/raid", label: "RAID", roles: ["pm", "ba", "sponsor", "product_owner"] },
  { href: "/team", label: "Team", roles: ["pm", "ba"] },
];

export const canOpen = (role: Role, href: string) =>
  PAGES.find((p) => p.href === href)?.roles.includes(role) ?? false;

export const homeFor = (role: Role) => PAGES.find((p) => p.roles.includes(role))!.href;
