import { Navigate } from "react-router-dom";

/** Keyword groups aren't supported by the backend; old links land on the Rank Tracker. */
function RankingsGroupsPage() {
  return <Navigate to=".." relative="path" replace />;
}

export default RankingsGroupsPage;
