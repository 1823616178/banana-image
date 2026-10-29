-- FTP 主存储：images 表记录图片所在存储（local = 旧版本地 storage 目录，ftp = FTP_DIR 下同名 key）
ALTER TABLE images ADD COLUMN storage VARCHAR(16) NOT NULL DEFAULT 'local' AFTER source;
-- 执行 npm run storage:migrate-ftp 后，已上传到 FTP 的记录会被更新为 'ftp'
