import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, uniqueIndex, index, check } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  hostTokenHash: text("host_token_hash").notNull(),
  hostParticipantId: text("host_participant_id").notNull(),
  ownerUserId: text("owner_user_id"),
  createdAt: integer("created_at").notNull(),
}, (table) => [uniqueIndex("idx_rooms_code").on(table.code)]);

export const participants = sqliteTable("participants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  roomId: text("room_id").references(() => rooms.id),
  participantTokenHash: text("participant_token_hash"),
  nameKey: text("name_key").notNull(),
  count: integer("count").notNull().default(0),
  version: integer("version").notNull().default(0),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("idx_participants_room_name").on(table.roomId, table.nameKey),
  check("participants_nonnegative_count", sql`${table.count} >= 0`),
]);

export const scoreOperations = sqliteTable("score_operations", {
  id: text("id").primaryKey(),
  participantId: text("participant_id").notNull().references(() => participants.id),
  delta: integer("delta").notNull(),
  applied: integer("applied").notNull().default(0),
}, (table) => [check("score_operations_valid_delta", sql`${table.delta} IN (-1, 1)`)]);

export const emoteEvents = sqliteTable("emote_events", {
  id: text("id").primaryKey(),
  participantId: text("participant_id").notNull().references(() => participants.id),
  emoji: text("emoji").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_emotes_created_at").on(table.createdAt),
  index("idx_emotes_participant_time").on(table.participantId, table.createdAt),
]);

export const participantAccess = sqliteTable("participant_access", {
  tokenHash: text("token_hash").primaryKey(),
  participantId: text("participant_id").notNull().references(() => participants.id),
  createdAt: integer("created_at").notNull(),
});
