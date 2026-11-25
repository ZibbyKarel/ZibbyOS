import { DetailScreen } from "../../../../../../features/integrations/DetailScreen";

/** A personal account's detail (Settings → Access → Accounts). */
export default async function PersonalAccountDetailPage({
  params,
}: {
  params: Promise<{ integrationId: string }>;
}) {
  const { integrationId } = await params;
  return <DetailScreen integrationId={integrationId} />;
}
