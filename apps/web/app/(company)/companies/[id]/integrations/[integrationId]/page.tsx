import { DetailScreen } from "../../../../../../features/integrations/DetailScreen";

export default async function CompanyIntegrationDetailPage({
  params,
}: {
  params: Promise<{ integrationId: string }>;
}) {
  const { integrationId } = await params;
  return <DetailScreen integrationId={integrationId} />;
}
