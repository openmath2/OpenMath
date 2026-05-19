import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { FeatureStrip } from "@/components/landing/feature-strip";
import { Footline } from "@/components/landing/footline";

export default function HomePage() {
  return (
    <div className="landing-canvas landing-grid relative min-h-screen">
      <Nav />
      <Hero />
      <FeatureStrip />
      <Footline />
    </div>
  );
}
