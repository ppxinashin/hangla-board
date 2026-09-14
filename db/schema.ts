import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const rooms = sqliteTable('rooms', {
  code: text('code').primaryKey(),
  hostKey: text('host_key').notNull(),
  hostParticipantId: text('host_participant_id'),
  stateJson: text('state_json').notNull(),
  version: integer('version').notNull().default(0),
  finalized: integer('finalized', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const participants = sqliteTable('participants', {
  id: text('id').primaryKey(),
  roomCode: text('room_code').notNull().references(() => rooms.code, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  lastSeen: integer('last_seen').notNull(),
}, table => [index('idx_participants_room_seen').on(table.roomCode, table.lastSeen)]);

export const roomImages = sqliteTable('room_images', {
  id: text('id').primaryKey(),
  roomCode: text('room_code').notNull().references(() => rooms.code, { onDelete: 'cascade' }),
  objectKey: text('object_key').notNull().unique(),
  fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [index('idx_room_images_room').on(table.roomCode)]);
