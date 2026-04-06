import { ResidentForm } from "@/components/residents/resident-form";

export default function NewResidentPage() {
  return (
    <div className="px-4 py-6">
      <h2 className="mb-6 text-xl font-semibold">Add Resident</h2>
      <ResidentForm />
    </div>
  );
}
