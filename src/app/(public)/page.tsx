import { AboutPage } from "@/components/about/about-page";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  return <AboutPage loggedIn={!!user} />;
}
