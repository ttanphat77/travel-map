import { z } from 'zod';
import { NOTE_MAX_LENGTH, PLACE_CATEGORIES, PLACE_NAME_MAX_LENGTH, type UserData } from './types';

const statusSchema = z.enum(['visited', 'wishlist']);
/** Dạng "YYYY-MM", đúng giá trị của ô chọn tháng. */
const dateSchema = z.string().regex(/^\d{4}-\d{2}$/);
const noteSchema = z.string().max(NOTE_MAX_LENGTH);
const timestampSchema = z.iso.datetime();

const markSchema = z.object({
  status: statusSchema,
  date: dateSchema.optional(),
  note: noteSchema.optional(),
  updatedAt: timestampSchema,
});

const regionSchema = z.object({
  countryId: z.string().min(2).max(10).optional(),
  provinceCode: z.string().regex(/^\d{2}$/).optional(),
});

const placeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(PLACE_NAME_MAX_LENGTH),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  status: statusSchema,
  date: dateSchema.optional(),
  note: noteSchema.optional(),
  category: z.enum(PLACE_CATEGORIES).optional(),
  region: regionSchema.optional(),
  hometown: z.boolean().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

/** Schema của dữ liệu người dùng. Server dùng schema này để từ chối dữ liệu sai trước khi ghi file. */
export const userDataSchema: z.ZodType<UserData> = z.object({
  schemaVersion: z.literal(1),
  countries: z.record(z.string(), markSchema),
  provinces: z.record(z.string(), markSchema),
  places: z.array(placeSchema),
});
