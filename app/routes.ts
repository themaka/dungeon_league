import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/leagues/new", "routes/leagues.new.tsx"),
  route("/leagues/:id/draft", "routes/leagues.$id_.draft.tsx"),
] satisfies RouteConfig;
