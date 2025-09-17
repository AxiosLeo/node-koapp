'use strict';

const fs = require('fs');
const { Command, printer } = require('@axiosleo/cli-tool');
const { Router, KoaApplication, result } = require('../');
const path = require('path');
const promisify = require('util').promisify;
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const {
  _exists,
  _is_file,
  _is_dir,
  _ext
} = require('@axiosleo/cli-tool/src/helper/fs');
const {
  _fixed
} = require('@axiosleo/cli-tool/src/helper/str');

const mimeTypes = {
  'css': 'text/css',
  'gif': 'image/gif',
  'html': 'text/html',
  'ico': 'image/x-icon',
  'jpeg': 'image/jpeg',
  'jpg': 'image/jpeg',
  'js': 'text/javascript',
  'json': 'application/json',
  'pdf': 'application/pdf',
  'png': 'image/png',
  'svg': 'image/svg+xml',
  'swf': 'application/x-shockwave-flash',
  'tiff': 'image/tiff',
  'txt': 'text/plain',
  'wav': 'audio/x-wav',
  'wma': 'audio/x-ms-wma',
  'wmv': 'video/x-ms-wmv',
  'xml': 'text/xml'
};

class HttpCommand extends Command {
  constructor() {
    super({
      name: 'http',
      desc: 'Start a http server quickly',
    });
    this.addArgument('dir', 'Static directory', 'optional', process.cwd());
    this.addOption('port', 'p', 'Port', 'optional', 80);
    this.html404Content = null;
  }

  formatFileSize(bytes) {
    if (bytes === 0) { return '--'; }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  getFileType(filename, is_dir, ext) {
    if (is_dir) { return 'folder'; }

    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
    const codeExts = ['js', 'ts', 'html', 'css', 'json', 'xml', 'sh', 'py', 'java', 'cpp', 'c', 'php'];

    if (imageExts.includes(ext.toLowerCase())) { return 'image'; }
    if (codeExts.includes(ext.toLowerCase())) { return 'code'; }
    return 'document';
  }

  getFileIcon(type) {
    const icons = {
      folder: '📁',
      document: '📄',
      image: '🖼️',
      code: '💻'
    };
    return icons[type] || '📄';
  }

  async list(dir) {
    if (!await _exists(dir)) {
      return [];
    }
    if (!await _is_dir(dir)) {
      throw new Error('Only support dir path');
    }
    const tmp = await readdir(dir);
    let files = [];
    await Promise.all(tmp.map(async (filename) => {
      let filepath = path.join(dir, filename);
      let is_dir = await _is_dir(filepath);
      let stats = await stat(filepath);
      let size = is_dir ? 0 : stats.size;
      let mtime = stats.mtime;
      let ext = is_dir ? '' : _ext(filename);

      files.push({
        filename,
        is_dir,
        filepath,
        size,
        mtime,
        ext
      });
    }));
    // debug.log(files);
    return files;
  }

  /**
   * @param {*} args 
   * @param {*} options 
   */
  async exec(args, options) {
    let dir = path.resolve(args.dir);
    const router = new Router('/***', {
      method: 'any',
      handlers: [async (context) => {
        const url = new URL(context.url, 'http://localhost');
        let d = path.join(dir, decodeURIComponent(url.pathname));
        printer.yellow(_fixed('[' + context.method + ']', 12, 'r')).green(decodeURIComponent(context.url)).println();
        if (!await _exists(d)) {
          if (!this.html404Content) {
            // 读取 404.html 文件内容
            const html404Path = path.join(__dirname, '../assets/html/404.html');
            let html404Content = 'Not Found';
            try {
              html404Content = fs.readFileSync(html404Path, 'utf8');
            } catch (_error) { // eslint-disable-line no-unused-vars
              // 如果读取失败，使用简单的 HTML 404 页面
              html404Content = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - 页面未找到</title>
  <style>
    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    h1 { color: #ff6b6b; font-size: 4rem; margin: 0; }
    h2 { color: #333; margin: 20px 0; }
    p { color: #666; line-height: 1.6; }
    .btn { display: inline-block; background: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <h2>页面未找到</h2>
    <p>抱歉，您访问的页面不存在或已被移动。</p>
    <a href="/" class="btn">返回首页</a>
  </div>
</body>
</html>`;
            }
            this.html404Content = html404Content;
          }

          result(this.html404Content, 404, { 'Content-Type': 'text/html' });
        }
        if (await _is_file(d)) {
          const extname = _ext(d);
          context.koa.type = extname;
          if (mimeTypes[extname]) {
            context.koa.headers['Content-Type'] = mimeTypes[extname];
          } else {
            let tmp = context.url.split('/');
            context.koa.headers['Content-disposition'] = 'attachment; filename=' + tmp[tmp.length - 1];
          }
          context.koa.headers['Content-Type'] = mimeTypes[extname];
          const stream = fs.createReadStream(d);
          context.koa.body = stream;
          return;
        }
        let files = await this.list(d);
        files = files.sort((a, b) => {
          // Directories first, then files, both alphabetically
          if (a.is_dir && !b.is_dir) { return -1; }
          if (!a.is_dir && b.is_dir) { return 1; }
          return a.filename.toLowerCase() < b.filename.toLowerCase() ? -1 : 1;
        });

        // Calculate statistics
        const folderCount = files.filter(f => f.is_dir).length;
        const fileCount = files.filter(f => !f.is_dir).length;
        const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);

        // Generate breadcrumb
        const pathParts = url.pathname.split('/').filter(p => p);
        let breadcrumb = '<a href="/">🏠 Home</a>';
        let currentPath = '';
        pathParts.forEach(part => {
          currentPath += '/' + part;
          breadcrumb += ` / <a href="${currentPath}">${decodeURIComponent(part)}</a>`;
        });

        // Generate file items HTML
        let fileItemsHTML = '';

        // Add parent directory link if not at root
        if (url.pathname !== '/') {
          // 计算正确的上级目录路径
          let parentPath = url.pathname;
          // 移除末尾的斜杠（如果有）
          if (parentPath.endsWith('/')) {
            parentPath = parentPath.slice(0, -1);
          }
          // 获取上级目录路径
          const lastSlashIndex = parentPath.lastIndexOf('/');
          parentPath = lastSlashIndex > 0 ? parentPath.substring(0, lastSlashIndex) : '/';
          // 确保路径以斜杠结尾（除了根目录）
          if (parentPath !== '/' && !parentPath.endsWith('/')) {
            parentPath += '/';
          }

          fileItemsHTML += `
            <div class="file-item" data-type="folder" onclick="window.location.href='${parentPath}'">
              <div class="file-icon folder">📁</div>
              <div class="file-info">
                <div class="file-name">../</div>
                <div class="file-meta">返回上级目录</div>
              </div>
              <div class="file-size">--</div>
            </div>`;
        }

        files.forEach(f => {
          let p = url.pathname === '/' ? '.' : url.pathname;
          // 确保路径正确拼接，避免双斜杠
          if (p.endsWith('/')) {
            p = p + f.filename;
          } else {
            p = p + '/' + f.filename;
          }
          const fileType = this.getFileType(f.filename, f.is_dir, f.ext);
          const fileIcon = this.getFileIcon(fileType);
          const fileSize = this.formatFileSize(f.size);
          const modifiedDate = f.mtime.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
          const fileTypeText = f.is_dir ? '文件夹' : (f.ext ? f.ext.toUpperCase() + '文件' : '文件');

          fileItemsHTML += `
            <div class="file-item" data-type="${fileType}" onclick="window.location.href='${p}'">
              <div class="file-icon ${fileType}">${fileIcon}</div>
              <div class="file-info">
                <div class="file-name">${f.filename}</div>
                <div class="file-meta">${fileTypeText} • 最后修改: ${modifiedDate}</div>
              </div>
              <div class="file-size">${fileSize}</div>
            </div>`;
        });

        const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>文件列表 - File List</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
          "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue",
          Helvetica, Arial, sans-serif;
        background: #f5f5f5;
        min-height: 100vh;
        padding: 20px;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        background: white;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        overflow: hidden;
      }

      .header {
        background: linear-gradient(45deg, #2196f3, #21cbf3);
        color: white;
        padding: 30px;
        text-align: center;
      }

      .header h1 {
        font-size: 2.5rem;
        margin-bottom: 10px;
        font-weight: 300;
      }

      .header p {
        font-size: 1.1rem;
        opacity: 0.9;
      }

      .file-list {
        padding: 30px;
      }

      .search-box {
        margin-bottom: 30px;
      }

      .search-box input {
        width: 100%;
        padding: 15px 20px;
        border: 2px solid #e0e0e0;
        border-radius: 25px;
        font-size: 16px;
        transition: border-color 0.3s;
      }

      .search-box input:focus {
        outline: none;
        border-color: #2196f3;
      }

      .file-item {
        display: flex;
        align-items: center;
        padding: 15px 20px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        margin-bottom: 10px;
        transition: all 0.3s;
        cursor: pointer;
      }

      .file-item:hover {
        background: #f5f5f5;
        border-color: #2196f3;
        transform: translateX(5px);
      }

      .file-icon {
        width: 40px;
        height: 40px;
        margin-right: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        font-size: 18px;
        color: white;
      }

      .file-icon.folder {
        background: #ffa726;
      }

      .file-icon.document {
        background: #42a5f5;
      }

      .file-icon.image {
        background: #66bb6a;
      }

      .file-icon.code {
        background: #ab47bc;
      }

      .file-info {
        flex: 1;
      }

      .file-name {
        font-size: 16px;
        font-weight: 500;
        margin-bottom: 5px;
        color: #333;
      }

      .file-meta {
        font-size: 14px;
        color: #666;
      }

      .file-size {
        font-size: 14px;
        color: #999;
        min-width: 80px;
        text-align: right;
      }

      .stats {
        display: flex;
        justify-content: space-around;
        padding: 20px;
        background: #f8f9fa;
        border-top: 1px solid #e0e0e0;
      }

      .stat-item {
        text-align: center;
      }

      .stat-number {
        font-size: 2rem;
        font-weight: bold;
        color: #2196f3;
        display: block;
      }

      .stat-label {
        font-size: 14px;
        color: #666;
        margin-top: 5px;
      }

      .breadcrumb {
        padding: 15px 30px;
        background: #f8f9fa;
        border-bottom: 1px solid #e0e0e0;
        font-size: 14px;
        color: #666;
      }

      .breadcrumb a {
        color: #2196f3;
        text-decoration: none;
      }

      .breadcrumb a:hover {
        text-decoration: underline;
      }

      @media (max-width: 768px) {
        .container {
          margin: 10px;
          border-radius: 5px;
        }

        .header {
          padding: 20px;
        }

        .header h1 {
          font-size: 2rem;
        }

        .file-list {
          padding: 20px;
        }

        .file-item {
          padding: 10px 15px;
        }

        .stats {
          flex-direction: column;
          gap: 15px;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>📁 文件管理器</h1>
        <p>File Manager</p>
      </div>

      <div class="breadcrumb">
        ${breadcrumb}
      </div>

      <div class="file-list">
        <div class="search-box">
          <input
            type="text"
            placeholder="🔍 在当前目录下搜索..."
            id="searchInput"
          />
        </div>

        <div id="fileContainer">
          ${fileItemsHTML}
        </div>
      </div>

      <div class="stats">
        <div class="stat-item">
          <span class="stat-number">${folderCount}</span>
          <div class="stat-label">文件夹</div>
        </div>
        <div class="stat-item">
          <span class="stat-number">${fileCount}</span>
          <div class="stat-label">文件</div>
        </div>
        <div class="stat-item">
          <span class="stat-number">${this.formatFileSize(totalSize)}</span>
          <div class="stat-label">总大小</div>
        </div>
      </div>
    </div>

    <script>
      // 搜索功能
      const searchInput = document.getElementById("searchInput");
      const fileContainer = document.getElementById("fileContainer");
      const fileItems = document.querySelectorAll(".file-item");

      searchInput.addEventListener("input", function () {
        const searchTerm = this.value.toLowerCase();

        fileItems.forEach((item) => {
          const fileName = item
            .querySelector(".file-name")
            .textContent.toLowerCase();
          const fileMeta = item
            .querySelector(".file-meta")
            .textContent.toLowerCase();

          if (fileName.includes(searchTerm) || fileMeta.includes(searchTerm)) {
            item.style.display = "flex";
          } else {
            item.style.display = "none";
          }
        });

        // 更新统计信息
        updateStats();
      });

      // 更新统计信息
      function updateStats() {
        const visibleItems = Array.from(fileItems).filter(
          (item) => item.style.display !== "none"
        );

        const folders = visibleItems.filter(
          (item) => item.getAttribute("data-type") === "folder"
        ).length;

        const files = visibleItems.length - folders;

        document.querySelector(
          ".stats .stat-item:nth-child(1) .stat-number"
        ).textContent = folders;
        document.querySelector(
          ".stats .stat-item:nth-child(2) .stat-number"
        ).textContent = files;
      }

      // 键盘快捷键
      document.addEventListener("keydown", function (e) {
        if (e.ctrlKey || e.metaKey) {
          if (e.key === "f") {
            e.preventDefault();
            searchInput.focus();
          }
        }
      });

      // 添加加载动画
      window.addEventListener("load", function () {
        fileItems.forEach((item, index) => {
          item.style.opacity = "0";
          item.style.transform = "translateY(20px)";

          setTimeout(() => {
            item.style.transition = "all 0.3s ease";
            item.style.opacity = "1";
            item.style.transform = "translateY(0)";
          }, index * 50);
        });
      });
    </script>
  </body>
</html>`;

        // debug.log('Generated HTML file listing');
        result(htmlContent, 200, { 'Content-Type': 'text/html' });
      }],
    });

    const app = new KoaApplication({
      port: parseInt(options.port),
      listen_host: '0.0.0.0',
      routers: [router],
      static: {
        rootDir: path.resolve(args.dir),
        index: 'index.html'
      }
    });
    app.start();
  }
}

module.exports = HttpCommand;
