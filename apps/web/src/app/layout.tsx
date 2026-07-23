import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Docket — Bangladesh Government Digital Observatory',
  description: 'Monitoring Bangladesh government websites for usability, accessibility, and citizen experience.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <nav>
            <a href="/">Docket</a>
            <span>Bangladesh Government Digital Observatory</span>
            <div>
              <a href="/websites">Websites</a>
              <a href="/organizations">Organizations</a>
              <a href="/issues">Issues</a>
            </div>
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          <p>Docket &mdash; Monitoring Bangladesh&apos;s digital public infrastructure</p>
        </footer>
      </body>
    </html>
  );
}
