import { getDb } from "@/db";
import { createScoreboardHandlers } from "@/lib/scoreboard-api";
export const dynamic = "force-dynamic";
export const {GET,POST}=createScoreboardHandlers({getDb});
