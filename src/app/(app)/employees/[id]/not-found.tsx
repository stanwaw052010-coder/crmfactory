import { RecordNotFound } from "@/components/shared/record-not-found";

export default function EmployeeNotFound() {
  return (
    <RecordNotFound
      title="Співробітника не знайдено"
      description="Можливо, профіль видалили або посилання застаріле."
      backHref="/employees"
      backLabel="До команди"
    />
  );
}
