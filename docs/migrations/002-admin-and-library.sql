-- 管理员角色、账号停用、个人风格预设/常用提示词（2026-10-29）。在 001 之后执行；执行前请备份。
-- 开发环境 DB_SYNCHRONIZE=true 时 TypeORM 会自动完成表结构变更，但仍需执行文件末尾的“指定管理员”语句（如已有账号）。
ALTER TABLE `users`
  ADD COLUMN `role` enum('admin','user') NOT NULL DEFAULT 'user' AFTER `passwordHash`,
  ADD COLUMN `disabled` tinyint NOT NULL DEFAULT 0 AFTER `role`;

ALTER TABLE `style_presets`
  ADD COLUMN `userId` bigint unsigned NULL AFTER `id`,
  ADD KEY `idx_style_presets_user` (`userId`);
-- 预设名称原为全局唯一，现改为由程序保证“同一归属内不重名”。旧唯一索引名用 SHOW INDEX FROM style_presets 确认后删除：
-- ALTER TABLE `style_presets` DROP INDEX `<旧的 name 唯一索引名>`;

ALTER TABLE `prompt_templates`
  ADD COLUMN `userId` bigint unsigned NULL AFTER `id`,
  ADD KEY `idx_prompt_templates_user` (`userId`);

-- 已存在的预设/模板 userId 为 NULL，即“共享”。标记种子已写入，避免重启后补回被删除的预设：
INSERT IGNORE INTO `settings` (`key`, `value`) VALUES ('seed:libraryVersion', '1');

-- 指定管理员：把最早注册的账号（即接管旧数据的账号）设为管理员。
UPDATE `users` SET `role` = 'admin' ORDER BY `id` ASC LIMIT 1;
