import './globals.css';

export const metadata = {
  title: 'DagzFlix - Streaming Unifie',
  description: 'Plateforme de streaming unifiee - Regardez et demandez vos contenus preferes',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen bg-[#0a0a0a] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
