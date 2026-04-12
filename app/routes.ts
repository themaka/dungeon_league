import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/leagues/new", "routes/leagues.new.tsx"),
  route("/leagues/:id", "routes/leagues.$id.tsx"),
  route("/leagues/:id/draft", "routes/leagues.$id_.draft.tsx"),
  route("/leagues/:id/teams/:teamId", "routes/leagues.$id_.teams.$teamId.tsx"),
] satisfies RouteConfig;
