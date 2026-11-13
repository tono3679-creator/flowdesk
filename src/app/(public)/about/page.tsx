import { AboutPage } from "@/components/about/about-page";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "このシステムについて" };

export default async function About() {
  const user = await getCurrentUser();
  return <AboutPage loggedIn={!!user} />;
}
