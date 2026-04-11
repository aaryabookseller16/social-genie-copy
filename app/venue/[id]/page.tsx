import { SinglePageGenieApp } from "@/app/components/SinglePageGenieApp";

export default async function VenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SinglePageGenieApp initialScreen="detail" initialVenueId={id} />;
}
