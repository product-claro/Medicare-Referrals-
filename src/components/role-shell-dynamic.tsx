"use client";

import dynamic from "next/dynamic";

// El AppShell/MenuLateral del kit de Claro One llaman `document` directamente en el cuerpo del
// render (no en un efecto), lo que revienta en SSR. Se carga solo en el cliente para evitarlo.
// (El `ssr: false` de next/dynamic solo se puede usar desde un modulo "use client", de ahi este
// archivo aparte en vez de ponerlo directo en role-shell.tsx).
export const RoleShellClientOnly = dynamic(() => import("./role-shell").then((m) => m.RoleShell), { ssr: false });
