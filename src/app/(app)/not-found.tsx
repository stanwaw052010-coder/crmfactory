import { RecordNotFound } from "@/components/shared/record-not-found";

export default function AppNotFound() {
  return (
    <RecordNotFound
      title="Сторінку не знайдено"
      description="Схоже, такого розділу немає. Поверніться на головну."
      backHref="/dashboard"
      backLabel="На головну"
    />
  );
}
