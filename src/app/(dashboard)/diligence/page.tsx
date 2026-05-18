import { getAuthenticatedUser } from "@/lib/auth";
import { DiligenceUploader } from "@/components/diligence/diligence-uploader";

export const metadata = {
  title: "Diligence | Kinroster",
};

export default async function DiligencePage() {
  // Same auth gate as every other dashboard page — redirects to /login
  // if no session. No role check: diligence is available to all
  // authenticated org members for now.
  await getAuthenticatedUser();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Diligence</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a recorded conversation. Kinroster transcribes it (English
          + Farsi) and returns a structured diligence summary.
        </p>
      </header>
      <DiligenceUploader />
    </div>
  );
}
