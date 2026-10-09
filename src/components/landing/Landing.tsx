import { AssistantShowcase } from "@/components/landing/AssistantShowcase";
import { DemoVideo } from "@/components/landing/DemoVideo";
import { Faq } from "@/components/landing/Faq";
import { Features } from "@/components/landing/Features";
import { FinalCta } from "@/components/landing/FinalCta";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";

export default function Landing() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground">
      <LandingNav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <AssistantShowcase />
        <DemoVideo />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
