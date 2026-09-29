import { BrowserRouter, Route, Routes } from "react-router-dom";
import AudienceSection from "./components/AudienceSection";
import CtaBand from "./components/CtaBand";
import Footer from "./components/Footer";
import Header from "./components/Header";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import { ConsentPage, OfferPage, PrivacyPage } from "./components/LegalPages";
import LiveDemo from "./components/LiveDemo";
import MaxFeatures from "./components/MaxFeatures";
import ProblemSolution from "./components/ProblemSolution";
import Questions from "./components/Questions";

function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <Hero />
        <ProblemSolution />
        <HowItWorks />
        <LiveDemo />
        <MaxFeatures />
        <AudienceSection />
        <Questions />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/offer" element={<OfferPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/consent" element={<ConsentPage />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  );
}
