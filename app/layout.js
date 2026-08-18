import "./globals.css";

export const metadata = {
  title: "Weekly Task Manager",
  description: "Team task management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
