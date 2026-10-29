-- 登录与按用户隔离（2026-10-29）。开发环境 DB_SYNCHRONIZE=true 时 TypeORM 会自动完成同样的变更；
-- 生产环境关闭同步时，请先备份数据库，再在 banana_image 库中执行本文件。
CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(32) NOT NULL,
  `passwordHash` varchar(255) NOT NULL,
  `lastLoginAt` datetime(3) NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tokenHash` char(64) NOT NULL,
  `userId` bigint unsigned NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_sessions_token` (`tokenHash`),
  KEY `idx_user_sessions_user` (`userId`),
  KEY `idx_user_sessions_expires` (`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `generations`
  ADD COLUMN `userId` bigint unsigned NULL AFTER `id`,
  ADD KEY `idx_generations_user_created` (`userId`, `createdAt`);

-- images.sha256 原为全局唯一，改为“同一用户内唯一”；旧唯一索引名请用 SHOW INDEX FROM images 确认后替换。
ALTER TABLE `images`
  ADD COLUMN `userId` bigint unsigned NULL AFTER `id`,
  ADD KEY `idx_images_user_created` (`userId`, `createdAt`),
  ADD UNIQUE KEY `uq_images_user_sha256` (`userId`, `sha256`);
-- ALTER TABLE `images` DROP INDEX `<旧的 sha256 唯一索引名>`;

-- 已有数据的 userId 为 NULL，第一个注册的账号会自动接管它们。
