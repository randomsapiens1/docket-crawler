import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://data.docket.bd'),
  title: 'Docket | Bangladesh Government Website Monitor',
  description:
    'Docket crawls Bangladesh government websites every week. Tracks broken links, page speed, and citizen experience across all .gov.bd domains. Free and open data.',
  keywords: [
    'Bangladesh government websites',
    'gov.bd broken links',
    'Bangladesh digital transparency',
    'government website monitor',
    'Bangladesh citizen services',
  ],
  openGraph: {
    title: 'Docket | Bangladesh Government Website Monitor',
    description:
      'Weekly crawl of all Bangladesh .gov.bd websites. Broken links, page health, and AI-scored citizen experience. Open data.',
    siteName: 'Docket',
    url: 'https://data.docket.bd',
    type: 'website',
  },
  alternates: {
    canonical: 'https://data.docket.bd',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-BPK0KG3334" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-BPK0KG3334');
        `}</Script>
      </head>
      <body>
        <header>
          <nav>
            <a href="/" className="nav-brand">
              <span className="nav-logo">Docket</span>
              <span className="nav-flag">🇧🇩</span>
            </a>
            <span className="nav-ext">
              <a href="https://docket.bd" target="_blank" rel="noopener noreferrer">
                docket.bd ↗
              </a>
            </span>
            <div className="nav-links">
              <a href="/">Dashboard</a>
              <a href="/websites">Websites</a>
              <a href="/issues">Issues</a>
            </div>
          </nav>
        </header>

        <main>{children}</main>

        <footer>
          <div className="footer-inner">
            <div>
              <div className="footer-brand">
                <a href="https://docket.bd" target="_blank" rel="noopener noreferrer">
                  Docket 🇧🇩
                </a>
              </div>
              <p className="footer-desc">
                Docket monitors Bangladesh government websites for broken links,
                slow pages, and citizen experience issues. Open data, updated weekly.
              </p>
              <div className="social-links">
                <a href="https://docket.bd" target="_blank" rel="noopener noreferrer" className="social-link">docket.bd</a>
                <a href="https://www.facebook.com/docket.bd" target="_blank" rel="noopener noreferrer" className="social-link">Facebook</a>
                <a href="https://www.instagram.com/docket.bd" target="_blank" rel="noopener noreferrer" className="social-link">Instagram</a>
                <a href="https://www.linkedin.com/company/trydocket/" target="_blank" rel="noopener noreferrer" className="social-link">LinkedIn</a>
              </div>
            </div>
            <div className="footer-col">
              <h4>Observatory</h4>
              <a href="/">Dashboard</a>
              <a href="/websites">Website Registry</a>
              <a href="/issues">Broken Links Report</a>
              <a href="https://docket.bd" target="_blank" rel="noopener noreferrer">Main Site</a>
            </div>
            <div className="footer-col">
              <h4>Methodology</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', lineHeight: 1.65 }}>
                Crawls run every Sunday via GitHub Actions.
                Up to 10 pages per site using headless Chromium.
                Links HEAD-tested for 4xx and 5xx errors.
                AI summaries by DeepSeek via OpenRouter.
              </p>
            </div>
          </div>
          <div className="footer-copy">
            <span>© {new Date().getFullYear()} Docket. Open data, open source.</span>
            <span>Not affiliated with the Government of Bangladesh.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
