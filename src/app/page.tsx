import EntryGate from "@/components/landing/EntryGate";
import Landing from "@/components/landing/Landing";

export default function Page() {
  return <EntryGate landing={<Landing />} />;
}
