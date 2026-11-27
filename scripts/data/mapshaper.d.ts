// Gói mapshaper không kèm file khai báo kiểu. File này chỉ khai báo hàm mà script dữ liệu dùng.
declare module 'mapshaper' {
  const mapshaper: {
    applyCommands(commands: string, inputs?: Record<string, unknown>): Promise<Record<string, string | Buffer>>;
  };
  export default mapshaper;
}
