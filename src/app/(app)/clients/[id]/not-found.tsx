import { RecordNotFound } from "@/components/shared/record-not-found";

export default function ClientNotFound() {
  return (
    <RecordNotFound
      title="Клієнта не знайдено"
      description="Можливо, картку видалили або посилання застаріле."
      backHref="/clients"
      backLabel="До списку клієнтів"
    />
  );
}
