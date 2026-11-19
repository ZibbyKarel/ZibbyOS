import { redirect } from "next/navigation";

/** `/knowledge` has no screen of its own — it is the Mozek page. */
export default function KnowledgePage() {
  redirect("/knowledge/brain");
}
