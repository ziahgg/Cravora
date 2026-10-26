/** Full-screen flows (restaurant, dish, checkout, tracking, forms): no tab bar. */
export default function FlowLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-dvh">{children}</div>;
}
