import type { Metadata, Viewport } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import { TEMA_CLARO_ONE } from "@arc2-0/claro-one-kit";
import "@arc2-0/claro-one-kit/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Referidos Medicare",
  description: "Referidos de clinicas para Medicare - Claro Insurance",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// TODO (modulo i18n): resolver idioma (cookie lang -> users.locale -> Accept-Language -> es).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AntdRegistry>
          <ConfigProvider theme={TEMA_CLARO_ONE}>{children}</ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
