/**
 * 文件导出器
 * 负责生成和下载各种格式的数据文件
 */

export class FileExporter {
  static downloadJSON(json: string, filename: string = 'epsvect-data.json'): void {
    FileExporter.download(json, filename, 'application/json');
  }

  static downloadCSV(csv: string, filename: string = 'epsvect-data.csv'): void {
    FileExporter.download(csv, filename, 'text/csv');
  }

  private static download(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}