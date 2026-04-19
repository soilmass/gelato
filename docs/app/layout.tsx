import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import 'nextra-theme-docs/style.css';
import type { ReactNode } from 'react';

export const metadata = {
  metadataBase: new URL('https://gelato.dev'),
  title: {
    default: 'Gelato',
    template: '%s – Gelato',
  },
  description:
    'The dogmatic, eval-verified Claude Code kit for modern full-stack TypeScript. A Neopolitan product.',
};

const navbar = (
  <Navbar
    logo={<span style={{ fontWeight: 600 }}>Gelato</span>}
    projectLink="https://github.com/soilmass/gelato"
  />
);

const footer = (
  <Footer>
    Gelato — the dogmatic Claude Code kit for modern full-stack TypeScript. A Neopolitan product.
    MIT.
  </Footer>
);

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          footer={footer}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/soilmass/gelato/blob/main/docs"
          sidebar={{ defaultMenuCollapseLevel: 1 }}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
