import { GoalDetailScreen } from "../../../../../features/goals/GoalDetailScreen";

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GoalDetailScreen goalId={id} />;
}
