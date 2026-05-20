import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { FeatureStrip } from "@/components/landing/feature-strip";
import { Faq } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";

export default function HomePage() {
  return (
    <div className="landing-canvas landing-grid relative min-h-screen">
      <Nav />
      <Hero />
      <FeatureStrip />
      <Faq />
      <Footer />
    </div>
  );
}
