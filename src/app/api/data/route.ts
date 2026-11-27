import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { userDataSchema } from '../../../domain/schema';
import { emptyUserData } from '../../../domain/types';

/** Dữ liệu người dùng nằm trong thư mục `data` ở gốc dự án. */
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'user-data.json');

/** Trả về dữ liệu đã lưu. Nếu chưa có file thì trả về dữ liệu rỗng. */
export async function GET() {
  let text: string;
  try {
    text = await readFile(DATA_FILE, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return Response.json(emptyUserData());
    throw error;
  }
  return Response.json(JSON.parse(text));
}

/** Ghi đè file bằng dữ liệu mới. Dữ liệu sai bị từ chối và file giữ nguyên. */
export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Nội dung gửi lên không phải JSON hợp lệ.' }, { status: 400 });
  }
  const result = userDataSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: 'Dữ liệu không đúng định dạng.', issues: result.error.issues }, { status: 400 });
  }
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify(result.data, null, 2)}\n`, 'utf8');
  return Response.json({ ok: true });
}
